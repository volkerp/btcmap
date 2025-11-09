import argparse
import csv
import os
import sqlite3
from datetime import datetime, timezone

start_ts = 1231006505  # Genesis block timestamp

conn = None

def satoshis_to_btc(satoshis):
    """ Convert satoshis to bitcoins """
    return satoshis / 1e8

# Load bitcoin prices from CSV
prices = {}
with open('/home/volker/projekte/btcmap2/bitcoin_prices.csv', 'r') as f:
    reader = csv.reader(f)
    for row in reader:
        date_str = row[0]
        price = float(row[1])
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        date_int = int(dt.strftime('%Y%m%d'))
        prices[date_int] = price

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", help="SQLite database file to store blockchain data", required=True)
    parser.add_argument("--start-ts", type=int, default=start_ts, help="Start timestamp for blockchain data")
    parser.add_argument("--end-ts", type=int, default=None, help="End timestamp for blockchain data")
    args = parser.parse_args()  

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS days
                 (date INTEGER PRIMARY KEY, 
              num_transactions INTEGER, 
              size INTEGER,
              minted_value INTEGER,
              output_value INTEGER,
              priceusd INTEGER,
              difficulty REAL)''')

    conn.commit()

    c = conn.cursor()
    c.execute("SELECT * FROM blocks WHERE timestamp >= ?", (start_ts,))
    rows = c.fetchall()
    last_day = None
    daystats = { 'num_transactions': 0, 'size': 0, 'minted_value': 0, 'output_value': 0, 'difficulty': 0.0, 'block_count': 0 }
    for row in rows:
        # calculate day from timestamp using UTC date functions
        # timestamp into datetime
        dt = datetime.fromtimestamp(row['timestamp'], timezone.utc)
        day = dt.date()

        if day != last_day:
            if daystats['block_count'] > 0:
                avg_transactions = daystats['num_transactions'] // daystats['block_count']
                avg_size = daystats['size'] // daystats['block_count']
                avg_minted = daystats['minted_value'] // daystats['block_count']
                avg_output = daystats['output_value'] // daystats['block_count']
                avg_difficulty = daystats['difficulty'] / daystats['block_count']
                date_int = int(last_day.strftime("%Y%m%d"))
                priceusd = int(prices.get(date_int, 0.0) * 100)
                print(f"Day: {last_day}, Transactions: {avg_transactions}, Size: {avg_size}, Minted Value: {satoshis_to_btc(avg_minted)}, Output Value: {satoshis_to_btc(avg_output)}, Difficulty: {avg_difficulty:.6f}, Price USD: {priceusd}")
                c.execute("INSERT OR REPLACE INTO days (date, num_transactions, size, minted_value, output_value, priceusd, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)",
                          (date_int, avg_transactions, avg_size, avg_minted, avg_output, priceusd, avg_difficulty))

            last_day = day
            daystats = { 'num_transactions': 0, 'size': 0, 'minted_value': 0, 'output_value': 0, 'difficulty': 0.0, 'block_count': 0 }

        daystats['num_transactions'] += row['num_transactions']
        daystats['size'] += row['size']
        daystats['minted_value'] += row['minted_value']
        daystats['output_value'] += row['output_value']
        daystats['difficulty'] += row['difficulty']
        daystats['block_count'] += 1

    conn.commit()
    conn.close()