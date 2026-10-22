export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DEMO_MODE === "1") {
    const { bootDemo } = await import("./lib/demo-boot");
    bootDemo();
  }
}
