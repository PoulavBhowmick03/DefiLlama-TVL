const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const BigNumber = require("bignumber.js");
const fetch = require("node-fetch");
const { Pool } = require("pg");
const cron = require("node-cron");

const app = express();
const port = 3000;

const GOVERNANCE_PROGRAM_IDS = [
  "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
  "gUAedF544JeE6NYbQakQvribHykUNgaPJqcgf3UQVnY",
  "GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J",
  "DcG2PZTnj8s4Pnmp7xJswniCskckU5E6XsrKuyD7NYFK",
  "AEauWRrpn9Cs6GXujzdp1YhMmv2288kBt3SdEcPYEerr",
  "G41fmJzd29v7Qmdi8ZyTBBYa98ghh3cwHBTexqCG1PQJ",
  "GovHgfDPyQ1GwazJTDY2avSVY8GGcpmCapmmCsymRaGe",
  "pytGY6tWRgGinSCvRLnSv4fHfBTMoiDGiCsesmHWM6U",
  "J9uWvULFL47gtCPvgR3oN7W357iehn5WF2Vn9MJvcSxz",
  "JPGov2SBA6f7XSJF5R4Si5jEJekGiyrwP2m7gSEqLUs",
  "Ghope52FuF6HU3AAhJuAAyS2fiqbVhkAotb7YprL5tdS",
  "5sGZEdn32y8nHax7TxEyoHuPS3UXfPWtisgm8kqxat8H",
  "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui",
  "GovMaiHfpVPw8BAM1mbdzgmSZYDw2tdP32J2fapoQoYs",
  "GCockTxUjxuMdojHiABVZ5NKp6At8eTKDiizbPjiCo4m",
  "HT19EcD68zn7NoCF79b2ucQF8XaMdowyPt5ccS6g1PUx",
  "GRNPT8MPw3LYY6RdjsgKeFji5kMiG1fSxnxDjDBu4s73",
  "ALLGnZikNaJQeN4KCAbDjZRSzvSefUdeTpk18yfizZvT",
  "A7kmu2kUcnQwAVn8B4znQmGJeUrsJ1WEhYVMtmiBLkEr",
  "MGovW65tDhMMcpEmsegpsdgvzb6zUwGsNjhXFxRAnjd",
  "jdaoDN37BrVRvxuXSeyR7xE5Z9CAoQApexGrQJbnj6V",
  "GMnke6kxYvqoAXgbFGnu84QzvNHoqqTnijWSXYYTFQbB",
  "hgovkRU6Ghe1Qoyb54HdSLdqN7VtxaifBzRmh9jtd3S",
  "jtogvBNH3WBSWDYD5FJfQP2ZxNTuf82zL8GkEhPeaJx",
  "dgov7NC8iaumWw3k8TkmLDybvZBCmd1qwxgLAGAsWxf",
];

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const connection = new Connection("custom-rpc-url", "confirmed");

const pool = new Pool({
  connectionString:
    "postgresql://username:password@localhost:5432/database",
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tvl (
        id SERIAL PRIMARY KEY,
        value NUMERIC,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    client.release();
  }
}

async function getGovernanceAccounts(programId) {
  const accounts = await connection.getProgramAccounts(
    new PublicKey(programId),
    {
      filters: [
        {
          dataSize: 325,
        },
      ],
    }
  );
  return accounts.map((account) => account.pubkey);
}

async function calculateTvl() {
  let totalTvl = new BigNumber(0);

  for (const programId of GOVERNANCE_PROGRAM_IDS) {
    console.log(`Fetching governance accounts for program ${programId}...`);
    const governanceAccounts = await getGovernanceAccounts(programId);
    console.log(`Found ${governanceAccounts.length} governance accounts.`);

    for (const governancePubkey of governanceAccounts) {
      console.log(
        `Processing governance account ${governancePubkey.toBase58()}...`
      );
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        governancePubkey,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      );

      for (const account of tokenAccounts.value) {
        const mintAddress = account.account.data.parsed.info.mint;
        const amount = new BigNumber(
          account.account.data.parsed.info.tokenAmount.amount
        );
        const price = await fetchTokenPrice(mintAddress);
        const value = amount
          .multipliedBy(price)
          .dividedBy(
            new BigNumber(10).pow(
              account.account.data.parsed.info.tokenAmount.decimals
            )
          );
        totalTvl = totalTvl.plus(value);
        console.log(
          `Token: ${mintAddress}, Amount: ${amount.toString()}, Price: ${price}, Value: ${value.toString()}`
        );
      }

      const solBalance = await connection.getBalance(governancePubkey);
      const solPrice = await fetchTokenPrice(
        "So11111111111111111111111111111111111111112"
      );
      const solValue = new BigNumber(solBalance)
        .multipliedBy(solPrice)
        .dividedBy(1e9); // 1e9 lamports per SOL
      totalTvl = totalTvl.plus(solValue);
      console.log(
        `SOL Balance: ${solBalance}, Price: ${solPrice}, Value: ${solValue.toString()}`
      );
    }
  }

  return totalTvl.toString();
}

async function fetchTokenPrice(mintAddress) {
  try {
    const response = await fetch(
      `https://price.jup.ag/v4/price?ids=${mintAddress}`
    );
    const data = await response.json();
    return data.data[mintAddress]?.price || 0;
  } catch (error) {
    console.error(`Error fetching price for ${mintAddress}:`, error);
    return 0;
  }
}

async function updateTvl() {
  console.log("Calculating TVL...");
  const tvl = await calculateTvl();
  console.log("TVL calculated:", tvl);

  const client = await pool.connect();
  try {
    await client.query("INSERT INTO tvl (value) VALUES ($1)", [tvl]);
    console.log("TVL updated in database");
  } catch (error) {
    console.error("Error updating TVL in database:", error);
  } finally {
    client.release();
  }
}

async function getLatestTvl() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT value, calculated_at FROM tvl ORDER BY calculated_at DESC LIMIT 1"
    );
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } finally {
    client.release();
  }
}

app.get("/stats/tvl", async (req, res) => {
  try {
    const latestTvl = await getLatestTvl();
    if (latestTvl) {
      res.json({
        totalValueUsd: latestTvl.value,
        lastUpdated: latestTvl.calculated_at,
      });
    } else {
      res.status(404).json({ error: "TVL data not available" });
    }
  } catch (error) {
    console.error("Error fetching TVL:", error);
    res.status(500).json({ error: "Error fetching TVL" });
  }
});

cron.schedule("0 0 1 * *", async () => {
  console.log("Running scheduled TVL update");
  await updateTvl();
});

initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`TVL API listening at http://localhost:${port}`);
  });
  updateTvl();
});
