import argparse
import os
from blockchain_parser.blockchain import Blockchain
import sqlite3

conn = None

def create_database(dbname):
    """ Create sqlite database to store blockchain data """
    conn = sqlite3.connect(dbname)
    c = conn.cursor()
    # Create tables
    c.execute('''CREATE TABLE IF NOT EXISTS blocks
                 (height INTEGER PRIMARY KEY, 
                timestamp INTEGER, 
              num_transactions INTEGER, 
              size INTEGER,
              minted_value INTEGER,
              output_value INTEGER,
              difficulty REAL)''')

    conn.commit()
    conn.close()

def block_timestamp(block):
    """ Get block int timestamp from block header """
    return int.from_bytes(block.header.hex[68:72], 'little')

def satoshis_to_btc(satoshis):
    """ Convert satoshis to bitcoins """
    return satoshis / 1e8

def get_coinbase_value(block):
    """ Calculate total coinbase value for a block """
    total_value = 0
    for tx in block.transactions:
        if tx.is_coinbase():
            for output in tx.outputs:
                total_value += output.value
    return total_value

def sum_transaction_values(block):
    """ Sum the values of all outputs in a block's transactions """
    total_value = 0
    for tx in block.transactions:
        for output in tx.outputs:
            total_value += output.value
    return total_value

def print_transaction(tx):
    print(f"Transaction ID: {tx.txid}, Size: {tx.size}, Version: {tx.version}, Locktime: {tx.locktime}")
    print(" Inputs:")
    for inp in tx.inputs:
        print(f"  - Sequence: {inp.sequence_number}")
    print(" Outputs:")
    for out in tx.outputs:
        print(f"  - Value: {out.value}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pathtoblockchain")
    parser.add_argument("-c", help="Create DB", dest="createdb", action="store_true")
    parser.add_argument("-d", help="DB name", dest="dbname", default="bitcoin")
    parser.add_argument("-s", help="Start at Block Height", dest="minheight", type=int, default=0)
    parser.add_argument("-e", help="Stop at Block Height", dest="maxheight", type=int, default=2000000)

    args = parser.parse_args()

    if not os.path.exists(args.dbname) or args.createdb:
        print(f"Database {args.dbname} does not exist. Creating...")
        create_database(args.dbname)

    conn = sqlite3.connect(args.dbname)

    blockchain = Blockchain(args.pathtoblockchain)    
    for block in blockchain.get_ordered_blocks(args.pathtoblockchain + "/index", start=args.minheight, end=args.maxheight):
        coinbase_value = get_coinbase_value(block)
        output_value = sum_transaction_values(block)
        c = conn.cursor()
        print(f"Processing Block Height: {block.height},  Timestamp: {block.header.timestamp} Difficulty: {block.header.difficulty} Num Transactions: {len(block.transactions)} Size: {block.size} Minted Coins: {satoshis_to_btc(coinbase_value)}, Total Output Value: {satoshis_to_btc(output_value)}")
        c.execute("INSERT OR REPLACE INTO blocks (height, timestamp, num_transactions, size, minted_value, output_value, difficulty)"
                  "VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (block.height, block_timestamp(block), len(block.transactions), 
                   block.size, coinbase_value, output_value, block.header.difficulty))
        
            
    conn.commit()
    conn.close()
