require('dotenv').config();

module.exports = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ETH_API_KEY}`,
    aavePoolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    aaveSubgraph: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
    scanBaseUrl: 'https://etherscan.io/tx/',
    minProfitUSD: 100,
    liquidationBonus: 0.05,
    pimlicoRpcUrl: `https://api.pimlico.io/v2/ethereum/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    pimlicoEntryPoint: '0x5FF137D4b0FDCD49DcA30c7B57b01A3c94eAE940'
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_POLYGON_API_KEY}`,
    aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    aaveSubgraph: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon',
    scanBaseUrl: 'https://polygonscan.com/tx/',
    minProfitUSD: 50,
    liquidationBonus: 0.05,
    pimlicoRpcUrl: `https://api.pimlico.io/v2/matic/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    pimlicoEntryPoint: '0x5FF137D4b0FDCD49DcA30c7B57b01A3c94eAE940'
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ARBITRUM_API_KEY}`,
    aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    aaveSubgraph: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
    scanBaseUrl: 'https://arbiscan.io/tx/',
    minProfitUSD: 75,
    liquidationBonus: 0.05,
    pimlicoRpcUrl: `https://api.pimlico.io/v2/arbitrum/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    pimlicoEntryPoint: '0x5FF137D4b0FDCD49DcA30c7B57b01A3c94eAE940'
  }
};
