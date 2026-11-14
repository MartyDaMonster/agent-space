export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let relative = specifier.slice(2);
    if (!relative.endsWith(".js") && !relative.endsWith(".mjs")) relative += ".js";
    return nextResolve(new URL(`../${relative}`, import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
}
