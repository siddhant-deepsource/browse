const { BrowseError } = require("./error");

/**
 * Recursively find a rule matching the name by walking up the scope/environment inheritance chain
 * @param {string | Word} name The rule name or Word AST node
 * @param {Scope} scope The scope to use
 */
const resolveModule = (name, scope) => {
  const moduleName = name.name;
  if (!scope) {
    throw new BrowseError({
      message: `Unknown module '${moduleName}'`,
      node: name,
    });
  }
  if (scope.modules[moduleName]) {
    return scope.modules[moduleName];
  }

  return resolveModule(name, scope.parent);
};

/**
 * Recursively find a rule matching the name by walking up the scope/environment inheritance chain
 * @param {string | Word} name The rule name or Word AST node
 * @param {Scope} scope The scope to use
 */
const resolveRule = (name, scope) => {
  const varName = typeof name === "string" ? name : name.name.name;
  if (!scope) {
    throw new BrowseError({
      message: `Rule '${varName}' is not defined`,
      node: typeof name === "string" ? null : name.name,
    });
  }
  if (typeof name !== "string" && name.module) {
    const moduleScope = resolveModule(name.module, scope);
    // moduleScope is always a top level scope, so resolveRule will only recurse twice,
    // hitting the base case the second time, if it fails
    try {
      return resolveRule(varName, moduleScope);
    } catch (e) {
      throw new BrowseError({
        message: `Rule '${varName}' is not defined in '${name.module.name}'`,
        node: name.module,
      });
    }
  }
  if (scope.rules.hasOwnProperty(varName)) {
    return scope.rules[varName];
  }

  return resolveRule(name, scope.parent);
};

/**
 * Recursively find a variable matching the name by walking up the scope/environment inheritance chain
 * @param {string | Ident} name The variable name
 * @param {Scope} scope The scope to use
 */
const resolveVar = (name, scope) => {
  const varName = typeof name === "string" ? name : name.name;
  if (!scope) {
    throw new BrowseError({
      message: `Variable '${varName}' is not defined`,
      node: typeof name === "string" ? null : name,
    });
  }

  if (scope.vars.hasOwnProperty(varName) && scope.vars[varName] !== undefined) {
    return scope.vars[varName];
  }

  return resolveVar(name, scope.parent);
};

/**
 * Recursively find a rule matching the name by walking up the scope/environment inheritance
 * chain and return the containing scope, not the rule
 * @param {string | Word} name The rule name
 * @param {Scope} scope The scope to use
 */
const resolveRuleScope = (name, scope) => {
  const varName = typeof name === "string" ? name : name.name.name;
  if (!scope) {
    throw new BrowseError({
      message: `Rule '${varName}' is not defined`,
      node: typeof name === "string" ? null : name.name,
    });
  }
  if (scope.rules.hasOwnProperty(varName)) {
    return scope;
  } else {
    return resolveRuleScope(name, scope.parent);
  }
};

/**
 * Recursively find a variable matching the name by walking up the scope/environment inheritance
 * chain and return the containing scope, not the value
 * @param {string | Ident} name The variable name
 * @param {Scope} scope The scope to use
 */
const resolveVarScope = (name, scope) => {
  const varName = typeof name === "string" ? name : name.name;
  if (!scope) {
    throw new BrowseError({
      message: `Variable '${varName}' is not defined`,
      node: typeof name === "string" ? null : name,
    });
  }
  if (scope.vars.hasOwnProperty(varName) && scope.vars[varName] !== undefined) {
    return scope;
  } else {
    return resolveVarScope(name, scope.parent);
  }
};

/**
 * Recursively find an internal variable matching the name by walking up the scope/environment inheritance chain
 * @param {string} name The variable name
 * @param {Scope} scope The scope to use
 * @param {any => boolean} predicate An optional predicate with which to test the resolved value
 */
const resolveInternal = (name, scope, predicate = () => true) => {
  if (!scope) {
    throw new Error(`Internal:: Internal Variable '${name}' is not defined`);
  }
  if (scope.internal[name] !== undefined && predicate(scope.internal[name])) {
    return scope.internal[name];
  } else {
    return resolveInternal(name, scope.parent, predicate);
  }
};

/**
 * Recursively find an internal variable matching the name by walking up the scope/environment inheritance chain
 * and return the scope instead of the value itself
 * @param {string} name The variable name
 * @param {Scope} scope The scope to use
 */
const resolveInternalScope = (name, scope) => {
  if (!scope) {
    throw new Error(`Internal:: Internal Variable '${name}' is not defined`);
  }
  if (scope.internal[name] !== undefined) {
    return scope;
  } else {
    return resolveInternalScope(name, scope.parent);
  }
};

/**
 * Recursively check if our scope meets certain conditions (usually used with isBrowser, isPage, or isRepl)
 * @param {scope => boolean} f the function used to check if we're in a scope
 * @param {Scope} scope The scope to use
 */
const validateScope = (f, scope) => {
  if (!scope) return false;
  if (f(scope)) return true;
  return validateScope(f, scope.parent);
};

module.exports = {
  resolveRule,
  resolveVar,
  resolveRuleScope,
  resolveVarScope,
  resolveInternal,
  resolveInternalScope,
  validateScope,
};
