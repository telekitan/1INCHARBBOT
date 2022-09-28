# 1INCHARBBOT

Finds the best trading route on over 30+ decentralized exchanges

### Setup and Run the project

- Open a command prompt and navigate to the this project folder
- install project dependencies buy running

  `npm install`

- Run the project by running the following commmand on the terminal

  `npm start`

### Managing Monitored Tokens/Pools

- Open `data` folder in the `src` folder

  `src/data`

- Open the `tokens.ts` and add more tokens like the one shown on the list

## Known errors that you might encounter and FIXES

Error: Insufficient funds for intrinsic transaction cost:

This error means,
The wallet that you connected to your `router` contract object does not have enough ETH balance to cover `value + gasPrice * gasLimit`.

- Warning! Error encountered during contract execution [Out of gas]
  Solution is to increase your gas limit
