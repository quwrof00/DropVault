const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-webview') {
    return context.resolveRequest(context, 'react-native-web-webview', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (!config.resolver.assetExts.includes('png')) {
  config.resolver.assetExts.push('png');
}

module.exports = withNativeWind(config, { input: "./global.css" });
