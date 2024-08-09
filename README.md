# Solana Realms TVL API

This API calculates and provides the Total Value Locked (TVL) for Solana Realms DAOs. It uses the Jupiter API for token pricing and stores the data in a Neon PostgreSQL database, with a fallback to in-memory storage.

## Prerequisites

- Node.js (v14 or later)
- npm (Node Package Manager)
- A Neon database account (https://neon.tech)

## Installation

1. Clone the repository:
2. Install the dependencies:
3. Set up your Neon database:
- Create a new database in your Neon dashboard
- Copy the connection string

4. Configure the database connection:
- Open `src/index.js`
- Replace `'postgresql://username:password@localhost:5432/database'` with your Neon database connection string

5. Add your custom RPC URL taken from Alchemy or QuickNode
## Running the API

1. Start the server:
2. The API will be available at `http://localhost:3000`

## API Endpoints

### Get TVL

- **URL**: `/stats/tvl`
- **Method**: GET
- **Success Response**:
- **Code**: 200
- **Content**: 
 ```json
 {
   "totalValueUsd": "1000000.50",
   "lastUpdated": "2023-06-01T00:00:00.000Z"
 }
 ```
- **Error Response**:
- **Code**: 404 or 500
- **Content**: 
 ```json
 {
   "error": "Error message"
 }
 ```
