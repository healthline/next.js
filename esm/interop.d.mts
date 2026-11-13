// A default import of a CommonJS declaration gives the whole module under
// `nodenext` but its `default` export under `bundler`. This names the
// `default` export under both.
export type DefaultExport<Module> = Module extends { default: infer Default } ? Default : Module
