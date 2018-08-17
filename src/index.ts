import flatten from "flat";
import faker from "faker";
import set from "lodash.set";

export type StringNode = {
  depth: number;
  value: string;
};

export const generateKey = (
  keyName: string,
  depth: number,
  keyReducers = {} as any,
  keyMap: Map<string, StringNode[]>
) => {
  let customGenerateKey = (fakerjs: typeof faker) =>
    `G_K_${fakerjs.random.alphaNumeric(5)}`;
  if (keyName in keyReducers) {
    customGenerateKey = keyReducers[keyName];
  }

  const cacheKey = `${keyName}`;
  let keyValue;
  if (!keyMap.has(cacheKey)) {
    keyValue = customGenerateKey(faker);
  } else {
    const previouslyGeneratedKeys = keyMap.get(cacheKey) as StringNode[];
    const ancestorKeys = previouslyGeneratedKeys.filter(n => n.depth <= depth);
    if (ancestorKeys.length > 0) {
      keyValue = faker.random.arrayElement(previouslyGeneratedKeys).value;
    } else {
      keyValue = customGenerateKey(faker);
    }
  }
  keyMap.set(cacheKey, [{ value: keyValue, depth }]);
  return keyValue;
};

export const generateData = (schema: any, keyReducers = {}) => {
  const keyMap = new Map() as Map<string, StringNode[]>;

  const flatSchema = flatten(schema);
  const flatSchemaKeys = Object.keys(flatSchema);
  const flatSchemaValues = Object.values(flatSchema);
  const depth = flatSchemaKeys.reduce(
    (acc, cur) => Math.max(acc, cur.split(".").length),
    0
  );
  const isVar = (s: string) => {
    return s.startsWith("{") && s.endsWith("}");
  };
  const keys = flatSchemaKeys.map(key => {
    return key
      .split(".")
      .map((s, i) => ({ value: s, depth: i }))
      .map(val => ({ isVar: isVar(val.value), ...val }))
      .map(varInPath => {
        const { isVar, value, depth } = varInPath;
        if (isVar) {
          return generateKey(value, depth, keyReducers, keyMap);
        } else {
          return value;
        }
      })
      .join(".");
  });
  const values = flatSchemaValues.map((valTypeOrReference, i) => {
    let generatedValue;
    if (typeof valTypeOrReference === "function") {
      generatedValue = valTypeOrReference(faker, keys[i]);
    } else if (isVar(valTypeOrReference)) {
      generatedValue = generateKey(valTypeOrReference, depth + 1, {}, keyMap);
    } else {
      switch (valTypeOrReference) {
        case "number": {
          generatedValue = faker.random.number();
          break;
        }
        case "string": {
          generatedValue = faker.random.words(2);
          break;
        }
        case "boolean": {
          generatedValue = faker.random.boolean();
          break;
        }
        case "timestamp": {
          generatedValue = faker.date.future(1, new Date(2018)).getTime();
          break;
        }
        default: {
          // console.log(`UNKNOWN ${valTypeOrReference}`);
          generatedValue = valTypeOrReference;
        }
      }
    }
    return generatedValue;
  });
  const tree = keys.reduce((acc, cur, i) => {
    set(acc, cur, values[i]);
    return acc;
  }, {});
  return { keys, values, tree };
};

export const generateJsonDefaultArgs = {
  schema: {} as any,
  keyReducers: {} as any,
  count: 1 as any
} as GenerateJsonArgs;

export type GenerateJsonArgs = {
  schema: any;
  keyReducers?: any;
  count?: number;
};

export const generateJson = ({
  schema = {},
  keyReducers = {},
  count = 1
} = generateJsonDefaultArgs) => {
  let jsonKeys = [] as string[];
  let jsonValues = [] as any[];
  let jsonTree = {};
  for (let i = 0; i < count; i += 1) {
    const { keys, values, tree } = generateData(schema, keyReducers);
    jsonKeys = [...keys, ...jsonKeys];
    jsonValues = [...values, ...jsonValues];
    jsonTree = {
      ...jsonTree,
      ...tree
    };
  }
  return { keys: jsonKeys, values: jsonValues, tree: jsonTree };
};
