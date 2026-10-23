// Entry point `.`. Each view area (list, form, detail, stats) appends one
// `export * from "./<area>/index.ts";` line below when it lands.
export * from "./core/index.ts";
export * from "./detail/index.ts";
export * from "./revisions/index.ts";
export * from "./bulk/index.ts";
export * from "./lifecycle/index.ts";
