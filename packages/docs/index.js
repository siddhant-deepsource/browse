const traverse = require("@babel/traverse").default;
const parser = require("@babel/parser");
const fs = require("fs");
const assert = require("assert");
const util = require("util");
const {
  h1,
  h2,
  h3,
  h4,
  bullet,
  bold,
  italics,
  indentAll,
  code,
  quote,
} = require("./readmeWriter");
const directories = ["web", "core"];
const show = (obj) =>
  console.log(
    console.log(util.inspect(obj, false, null, true /* enable colors */))
  );

const fileMap = Object.assign(
  {},
  ...directories.map((directory) => ({
    [directory]: fs.readdirSync(`../${directory}/lib`),
  }))
);

const split = (arr, n) => {
  const rtn = [];
  const length = arr.length;
  for (let i = 0; i < length; i += n) {
    rtn.push(arr.slice(i, i + n));
  }
  return rtn;
};

const safeMergeObjs = (o1, o2) => {
  const rtn = { ...o2 };
  Object.keys(o1).forEach((key) => {
    if (rtn[key] !== undefined) {
      const throwStr = `Cannot define key ${key} multiple times on the same structure`;
      throw new Error(throwStr);
    }
    rtn[key] = o1[key];
  });
  return rtn;
};

//Removes a bunch of extra stuff from block comments such as the newlines and the *'s
const cleanComment = (comment) =>
  comment
    .split("\n")
    .map((line) => line.split("*")[1])
    .filter(Boolean)
    .join("")
    .trim();

const pullTags = (comment) => {
  const rtn = {};
  //Remove Blank Lines
  const cleanCommentLines = cleanComment(comment)
    .split(/[{}]/)
    .map((line) => line.trim());
  const kvps = split(cleanCommentLines, 2)
    .filter((kvp) => kvp.length === 2)
    .forEach((kvp) => (rtn[kvp[0]] = kvp[1]));
  return rtn;
};

const pullAllTags = (comments) =>
  comments.map((comment) => pullTags(comment.value)).reduce(safeMergeObjs, {});

const parseParams = (paramString) => {
  return split(paramString.split(/[\[\]]/).slice(1), 2).map((arr) => {
    const [nameAndType, description] = arr;
    const [name, type] = nameAndType.split(":");
    return {
      name: name.trim(),
      type: type.trim(),
      description: description.trim(),
    };
  });
};

const parseRtn = (rtnString) => {
  const [type, description] = rtnString.split(/[\[\]]/).slice(1);
  return {
    type,
    description,
  };
};

const generateHelp = (rules) => {
  const rtn = {};
  rules.map((rule) => {
    //The rule was defined as a key on an object
    if (rule.node.type === "ObjectProperty") {
      const id = rule.node.key.name || rule.node.key.value;
      if (rtn[id] !== undefined) {
        const throwStr = `Rule ${rule.node.key.name} was defined twice`;
        throw new Error(throwStr);
      }
      rtn[id] = rule.comments["@help"];
    }
  });
  return rtn;
};

/*
 * Process a single annotated rule
 */
const processRule = (rule) => {
  const rtn = {};
  const tags = pullAllTags(rule.leadingComments);
  /* Parse the help tag */
  if (tags["@help"] === undefined && tags["@desc"] === undefined) {
    //If the help and desc tags have no data we grab all of the text
    //TODO: Return just the comments not within a tag
    rtn.help = rule.leadingComments
      .map((node) => cleanComment(node.value))
      .join("\n");
  } else {
    //else we just extract data from @help tags
    rtn.help = tags["@help"] || tags["@desc"];
  }

  /* Parse the desc tag */
  if (tags["@desc"] === undefined && tags["@help"] === undefined) {
    //If the help and desc tags have no data we grab all of the text
    //TODO: Return just the comments not within a tag
    rtn.help = rule.leadingComments
      .map((node) => cleanComment(node.value))
      .join("\n");
  } else {
    //else we just extract data from @help tags
    rtn.help = tags["@desc"] || tags["@help"];
  }

  /* Parse the params tag */
  if (tags["@params"] !== undefined) {
    rtn.params = parseParams(tags["@params"]);
  }

  /* Parse the returns tag */
  if (tags["@return"] !== undefined) {
    rtn.rtn = parseRtn(tags["@return"]);
  }

  /* Parse the example tag */
  if (tags["@example"] !== undefined) {
    rtn.example = tags["@example"];
  }

  /* Parse the example tag */
  if (tags["@notes"] !== undefined) {
    rtn.notes = tags["@notes"];
  }
  return rtn;
};

/*
 * Process multiple rules inside an object
 *
 * A rule consists of a
 * {
 *   node,
 *   leadingComment,
 *   name
 * }
 */
const processRules = (rules) => {
  const rtn = {};
  const commentedRules = rules.filter(
    (rule) => rule.leadingComments !== undefined
  );
  if (rules.length != commentedRules.length) {
    const nonCommented = rules.filter(
      (rule) => rule.leadingComments === undefined
    );
    const singleRule = nonCommented.length === 1;
    const throwStr = `${singleRule ? "Rule" : "Rules"} ${nonCommented
      .map((node) => node.key.name)
      .join(", ")} ${singleRule ? `isn't` : `aren't`} commented`;
    throw new Error(throwStr);
  }

  commentedRules.forEach((rule) => {
    const ruleName = rule.key.name || rule.key.value;
    rtn[ruleName] = {};
    const tags = pullAllTags(rule.leadingComments);
    /* Parse the help tag */
    if (tags["@help"] === undefined && tags["@desc"] === undefined) {
      //If the help and desc tags have no data we grab all of the text
      //TODO: Return just the comments not within a tag
      rtn[ruleName].help = rule.leadingComments
        .map((node) => cleanComment(node.value))
        .join("\n");
    } else {
      //else we just extract data from @help tags
      rtn[ruleName].help = tags["@help"] || tags["@desc"];
    }

    /* Parse the desc tag */
    if (tags["@desc"] === undefined && tags["@help"] === undefined) {
      //If the help and desc tags have no data we grab all of the text
      //TODO: Return just the comments not within a tag
      rtn[ruleName].help = rule.leadingComments
        .map((node) => cleanComment(node.value))
        .join("\n");
    } else {
      //else we just extract data from @help tags
      rtn[ruleName].help = tags["@desc"] || tags["@help"];
    }

    /* Parse the params tag */
    if (tags["@params"] !== undefined) {
      rtn[ruleName].params = parseParams(tags["@params"]);
    }

    /* Parse the returns tag */
    if (tags["@return"] !== undefined) {
      rtn[ruleName].rtn = parseRtn(tags["@return"]);
    }

    /* Parse the example tag */
    if (tags["@example"] !== undefined) {
      rtn[ruleName].example = tags["@example"];
    }

    /* Parse the example tag */
    if (tags["@notes"] !== undefined) {
      rtn[ruleName].notes = tags["@notes"];
    }
  });
  return rtn;
};

const processConfig = (config) => {
  const rtn = {};
  if (config) {
    const properties = config.value.properties;

    //We first look for the @config annotation

    properties.map((property) => {
      //TODO: We should try to grab the name, type, and init value
      const propertyName = property.key.name;

      const tags = pullAllTags(property.leadingComments || []);

      if (tags["@config"] === undefined) {
        rtn[propertyName] = (property.leadingComments || [])
          .map((node) => cleanComment(node.value))
          .join("\n");
      }
      rtn[propertyName] = tags["@config"];
    });
  }
  return rtn;
};

module.exports = () => {
  const rtn = {};
  const commentArr = [];

  directories.map((directory) => {
    console.log("ENTERING DIR", directory);
    return fileMap[directory].map((file) => {
      console.log("ENTERING FILE", file);
      const code = fs.readFileSync(`../${directory}/lib/${file}`, "utf8");
      const ast = parser.parse(code);
      let scope;
      traverse(ast, {
        enter(path) {
          /*
           * This is for the 'const getBrowserScope = () => ({})) style
           */
          if (
            path.isVariableDeclaration() &&
            path.node.declarations &&
            path.node.declarations.init &&
            path.node.declarations.init.type === "ArrowFunctionExpression" &&
            path.node.leadingComments !== undefined
          ) {
            //Find the scope tag
            const tags = pullAllTags(path.node.leadingComments);
            if (tags["@scope"]) {
              assert(
                !scope,
                "There can only be one scope declaration per file"
              );
              const scopeName = tags["@name"] || file.split(".")[0];
              scope = scopeName;
              rtn[scopeName] = {};

              /* Deal with the Rule annotations */

              //We won't use the path.findChild since we're looking for a very specific child
              console.log(path.node.declarations[0].init.body);
              const ruleNode = path.node.declarations[0].init.body.properties.filter(
                (property) => property.key.name === "rules"
              );
              assert(ruleNode.length <= 1, "There can only be one fn property");
              //Rules
              const rules = ruleNode[0].value.properties;

              rtn[scopeName]["rules"] = processRules(rules);
              /* Deal with the Config annotations */

              const configDeclarations = path.node.declarations[0].init.body.properties.filter(
                (property) => property.key.name === "config"
              );
              assert(
                configDeclarations.length <= 1,
                "There can only be one config property"
              );
              const config = configDeclarations[0];
              rtn[scopeName]["config"] = processConfig(config);
            }
          } else if (

          /*
           * This is for the 'module.exports = () => ({})) style
           */
            path.isExpressionStatement() &&
            path.node.leadingComments !== undefined
          ) {
            //Find the scope tag
            const tags = pullAllTags(path.node.leadingComments);
            if (tags["@scope"]) {
              assert(
                !scope,
                "There can only be one scope declaration per file"
              );
              const scopeName = tags["@name"] || file.split(".")[0];
              scope = scopeName;
              rtn[scopeName] = {};

              /* Deal with the Rule annotations */

              //We won't use the path.findChild since we're looking for a very specific child
              const ruleNode = path.node.expression.right.body.properties.filter(
                (property) => property.key.name === "rules"
              );
              assert(ruleNode.length <= 1, "There can only be one fn property");
              //Rules
              const rules = ruleNode[0].value.properties;

              rtn[scopeName]["rules"] = processRules(rules);
              /* Deal with the Config annotations */

              const configDeclarations = path.node.expression.right.body.properties.filter(
                (property) => property.key.name === "config"
              );
              assert(
                configDeclarations.length <= 1,
                "There can only be one config property"
              );
              const config = configDeclarations[0];
              rtn[scopeName]["config"] = processConfig(config);
            }
          }

          //If the structure is not recognized, we can search for tags manually and do our best
          //In this case the function must also have an '@scope' tag
          else if (path.node.leadingComments !== undefined) {
            //Find the scope tag
            const tags = pullAllTags(path.node.leadingComments);
            //          console.log("TAGS", tags);
            if (tags["@scope"] != undefined && tags["@rule"] != undefined) {
              //In the context of a single rule, scope is used to tell us which scope it belongs to, else we'll use any scope tag we have already
              const scopeName = tags["@scope"] || scope;
              rtn[scopeName] = {};

              /* Deal with the Rule annotations */
              //Rules
              if (!rtn[scopeName]["rules"]) rtn[scopeName]["rules"] = {};

              rtn[scopeName]["rules"][tags["@rule"]] = processRule(path.node);
            }
          }

          //Take anything with leading comments
          /*    if (path.node.leadingComments) {
            const commentNodes = path.node.leadingComments;
            const docComments = commentNodes.filter(commentNode => commentNode.value.startsWith("*"));
            console.log("CommentNodesParent", path.findParent(path => path.isObjectProperty() && path.node.key.name === 'rules'));
            if(docComments.length) {
              const data = {
                node: path.node,
                comments: docComments.map(comment => comment.value).map(pullTags).reduce((o1, o2) => safeMergeObjs(o1, o2), {})
              }
      	commentArr.push(data)
            }
          }*/
        },
      });
    });
  });

  return rtn;
};
