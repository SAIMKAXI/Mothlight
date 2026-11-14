import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function jsxAttributes(node) {
  const entries = new Map();
  for (const attribute of node.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) {
      entries.set(attribute.name.getText(), attribute.initializer ?? null);
    }
  }
  return entries;
}

function hasValue(attributes, name) {
  const initializer = attributes.get(name);
  if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return false;
  const expression = initializer.expression;
  if (ts.isArrowFunction(expression) && ts.isBlock(expression.body)) {
    return expression.body.statements.length > 0;
  }
  if (ts.isFunctionExpression(expression) && expression.body.statements.length === 0) return false;
  return true;
}

export function auditInteractiveBindings(sourceText) {
  const source = ts.createSourceFile('App.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const failures = [];
  const counts = {
    pressables: 0,
    textInputs: 0,
    iconButtons: 0,
    panelActions: 0,
    toggles: 0,
    flatLists: 0,
    modals: 0,
  };

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const attributes = jsxAttributes(node);

      const requireCallback = (attribute, description) => {
        if (!hasValue(attributes, attribute)) {
          failures.push(`${tag} requires a non-empty ${attribute} callback (${description}).`);
        }
      };

      if (tag === 'Pressable' || tag === 'Button' || /^Touchable/.test(tag)) {
        counts.pressables += 1;
        requireCallback('onPress', 'tap action');
      }
      if (tag === 'IconButton') {
        counts.iconButtons += 1;
        requireCallback('onPress', 'toolbar or header action');
      }
      if (tag === 'PanelAction') {
        counts.panelActions += 1;
        requireCallback('onPress', 'panel action');
      }
      if (tag === 'ToggleRow') {
        counts.toggles += 1;
        requireCallback('onChange', 'setting update');
      }
      if (tag === 'DateTimePicker') {
        requireCallback('onValueChange', 'custom reminder date/time selection');
        if (!attributes.has('value')) failures.push('DateTimePicker must be controlled with a value.');
      }
      if (tag === 'TextInput') {
        counts.textInputs += 1;
        requireCallback('onChangeText', 'text input update');
        if (!attributes.has('value') && !attributes.has('defaultValue')) {
          failures.push('TextInput must be controlled or provide a defaultValue.');
        }
      }
      if (tag === 'FlatList') {
        counts.flatLists += 1;
        for (const attribute of ['data', 'keyExtractor', 'renderItem']) {
          if (!attributes.has(attribute)) failures.push(`FlatList requires ${attribute}.`);
        }
      }
      if (tag === 'Modal') {
        counts.modals += 1;
        requireCallback('onRequestClose', 'system back / dismiss action');
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return { counts, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appSource = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  const { counts, failures } = auditInteractiveBindings(appSource);
  if (failures.length) {
    console.error('Interactive binding audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Interactive binding audit passed:', counts);
  }
}
