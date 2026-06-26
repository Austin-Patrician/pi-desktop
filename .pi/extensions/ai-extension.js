export default function (pi) {
//   pi.registerProvider("openai", {
//     baseUrl: "https://your-proxy.com/v1",   // 自定义地址
//     headers: {
//       "X-Custom-Header": "value"             // 可选：自定义 Header
//     }
//   });

  // 也可以覆盖 DeepSeek
  pi.registerProvider("deepseek", {
    baseUrl: "https://api.routin.ai/v1",   // 自定义地址
    apiKey: "ak-xxxxxxx",

  });
}