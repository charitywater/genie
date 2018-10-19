#!/usr/local/bin/node

const acorn = require('acorn');
const fs = require('fs');
const jsx = require('acorn-jsx');
const { exec } = require('child_process');

const fileAndLineNumber = process.argv[2];

if (fileAndLineNumber === undefined) {
  console.log('You must provide path to a spec');
  return process.exit(1);
}

let file = fileAndLineNumber.split(':')[0];
let lineNumber = fileAndLineNumber.split(':')[1];
let spec = fs.readFileSync(file);

let source = acorn.Parser.extend(jsx()).parse(spec.toString(), {
  ecmaVersion: 9,
  locations: true,
  sourceType: 'module',
});

const describeBlock = source.body.find(
  node => node.type === 'ExpressionStatement',
);

let children = [];

const getChildren = ((body) => {
  const block = body
    .filter(node => node.type === 'ExpressionStatement')
    .filter(
      node =>
        node.expression.callee &&
        (node.expression.callee.name === 'it' ||
          node.expression.callee.name === 'describe'),
    );

  if(block.length) {
    children.push(block);
  }

  block.forEach((node) => {
    if(node.expression.arguments[1].body.body) {
      getChildren(node.expression.arguments[1].body.body);
    }
  });
});

getChildren(describeBlock.expression.arguments[1].body.body);

const child = [].concat.apply([], children).filter(
  node => lineNumber >= node.loc.start.line && lineNumber <= node.loc.end.line,
).slice(-1)[0];

let description;

if (child) {
  description = child.expression.arguments[0].value;
} else {
  description = describeBlock.expression.arguments[0].value;
}

console.log(`running: ${description}`);

const karma = exec(`./node_modules/.bin/karma run -- --grep="${description}"`);

karma.stdout.pipe(process.stdout);
