import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** Runs repository-owned logic with explicit dependencies; no copied implementation. */
function compile(source: string, dependencies: Record<string, unknown>, result: string) {
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
  }).outputText;
  return new Function(...Object.keys(dependencies), `${output}; return ${result};`)(
    ...Object.values(dependencies)
  );
}

export function compileMembers(
  location: URL,
  names: string[],
  dependencies: Record<string, unknown> = {}
) {
  const source = ts.createSourceFile(
    location.pathname,
    readFileSync(location, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const members: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) &&
      names.includes(node.name.getText(source))
    )
      members.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(
    members.length,
    names.length,
    'All exercised members must exist in the actual source.'
  );
  return compile(`class Harness { ${members.join('\n')} }`, dependencies, 'Harness');
}

export function compileInitializer(
  location: URL,
  name: string,
  dependencies: Record<string, unknown>
) {
  const source = ts.createSourceFile(
    location.pathname,
    readFileSync(location, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  let value = '';
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer)
      value = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(value, `${name} must exist in the actual source.`);
  return compile(`const harness = ${value};`, dependencies, 'harness');
}
