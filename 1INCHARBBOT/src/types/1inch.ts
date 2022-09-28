export interface Quote {
    fromToken: Token;
    toToken: Token;
    toTokenAmount: string;
    fromTokenAmount: string;
    protocols: Array<Array<Array<Protocol>>>;
    estimatedGas: number;
}

export interface Token {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    logoURI: string;
    eip2612?: boolean;
}

export interface Protocol {
    name: string;
    part: number;
    fromTokenAddress: string;
    toTokenAddress: string;
}

export interface Failure {
    statusCode: string,
    message: string,
    error: string
}
export interface Swap {
    fromToken: Token;
    toToken: Token;
    toTokenAmount: string;
    fromTokenAmount: string;
    protocols: Array<Protocol>;
    estimatedGas: number;
    tx: Tx;
    gasLimit?: number;
    hash?: string;
}
export interface Tx {
    from: string,
    to: string,
    data: string,
    value: string,
    gasPrice: string,
    gas: number,
}
export interface Approve {
    data: string,
    gasPrice: string,
    to: string,
    value: string
    success?: boolean
    hash?: string
}
export interface Protocols {
    protocols: string[]
}

export interface UserToken {
    address: string
    ticker: string
    description: string
}

