module.exports = (path, options) => {
  try {
    return options.defaultResolver(path, options);
  } catch (error) {
    if (path.endsWith('.js')) {
      const tsPath = path.replace(/\.js$/, '.ts');
      try {
        return options.defaultResolver(tsPath, options);
      } catch {}

      const tsxPath = path.replace(/\.js$/, '.tsx');
      try {
        return options.defaultResolver(tsxPath, options);
      } catch {}
    }

    throw error;
  }
};
