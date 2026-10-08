import assert from 'node:assert/strict';
import test from 'node:test';
import {
  houseGrid,
  positionInSection,
  sectionAtPosition,
  sectionLabel,
} from '../src/domain/houseLayout';
import { buildInstallationPlan } from '../src/domain/siteWorkflow';
import { completeSiteSurvey } from './siteTestFixture';

test('long houses generate as many 30 metre sections as coverage requires', () => {
  const layout = houseGrid(120, 20);
  assert.deepEqual(
    { columns: layout.columns, rows: layout.rows, count: layout.count, sections: layout.sections },
    { columns: 4, rows: 1, count: 4, sections: ['A', 'B', 'C', 'D'] },
  );
});

test('wide houses use a two-dimensional section grid', () => {
  const layout = houseGrid(60, 60);
  assert.equal(layout.columns, 2);
  assert.equal(layout.rows, 2);
  assert.deepEqual(layout.sections, ['A', 'B', 'C', 'D']);
  const placement = positionInSection('D', layout);
  assert.equal(sectionAtPosition(placement.x, placement.y, layout), 'D');
});

test('section labels continue beyond Z', () => {
  assert.equal(sectionLabel(25), 'Z');
  assert.equal(sectionLabel(26), 'AA');
  assert.equal(sectionLabel(51), 'AZ');
});

test('installation planning enforces the coverage minimum while allowing extra nodes', () => {
  const survey = completeSiteSurvey();
  survey.house.lengthMetres = 120;
  survey.house.widthMetres = 20;
  survey.sensors.plannedNodes = 2;
  let plan = buildInstallationPlan(survey);
  assert.equal(plan.sections, 4);
  assert.equal(plan.nodeCount, 4);

  survey.sensors.plannedNodes = 6;
  plan = buildInstallationPlan(survey);
  assert.equal(plan.nodeCount, 6);
});
