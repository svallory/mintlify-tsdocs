import { describe, it, expect } from 'bun:test';
import { GenerateAction } from '../../src/cli/GenerateAction';
import { BaseAction } from '../../src/cli/BaseAction';

describe('GenerateAction', () => {
  it('should extend BaseAction', () => {
    const mockParser = {} as any;
    const action = new GenerateAction(mockParser);

    expect(action).toBeInstanceOf(BaseAction);
  });

  it('should have access to buildApiModel from BaseAction', () => {
    const mockParser = {} as any;
    const action = new GenerateAction(mockParser);

    // Check that protected method exists
    expect(typeof (action as any).buildApiModel).toBe('function');
  });
});
