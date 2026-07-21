export const CONVERTER_TARGETS = {
  clash: { target: "clash", extension: "yaml" }, clashr: { target: "clashr", extension: "yaml" },
  quan: { target: "quan", extension: "conf" }, quanx: { target: "quanx", extension: "conf" },
  loon: { target: "loon", extension: "conf" }, ss: { target: "ss", extension: "txt" },
  sssub: { target: "sssub", extension: "json" }, ssd: { target: "ssd", extension: "txt" },
  ssr: { target: "ssr", extension: "txt" }, surfboard: { target: "surfboard", extension: "conf" },
  surge2: { target: "surge", version: "2", extension: "conf" },
  surge3: { target: "surge", version: "3", extension: "conf" },
  surge4: { target: "surge", version: "4", extension: "conf" },
  trojan: { target: "trojan", extension: "txt" }, v2ray: { target: "v2ray", extension: "txt" },
  mixed: { target: "mixed", extension: "txt" }, auto: { target: "auto", extension: "txt" },
};

export function createSubconverterUrl(endpointValue, inputs, type) {
  const settings = CONVERTER_TARGETS[type];
  if (!settings) throw new Error(`unsupported target: ${type}`);
  const endpoint = new URL(endpointValue);
  if (!/^https?:$/.test(endpoint.protocol)) throw new Error("endpoint must use HTTP or HTTPS");
  const basePath = endpoint.pathname.replace(/\/$/, "");
  endpoint.pathname = basePath.endsWith("/sub") ? basePath : `${basePath}/sub`;
  endpoint.search = "";
  endpoint.searchParams.set("target", settings.target);
  endpoint.searchParams.set("url", inputs.join("|"));
  if (settings.version) endpoint.searchParams.set("ver", settings.version);
  return endpoint;
}
