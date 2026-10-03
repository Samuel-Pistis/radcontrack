import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContrastTable } from './ContrastTable';

describe('daily contrast table', () => {
  it('renders computed CT and MRI bottle equivalents and negative balance cells', () => {
    const values={jodascan300:{mls:514,bottles:0},hexopack350:{mls:49,bottles:0},gastrolux:{mls:0,bottles:0},mriContrast:{mls:38,bottles:0}};
    const noop=()=>{};
    const {container}=render(<ContrastTable shift="morning" isMorning getReceivedValues={()=>({mls:0,bottles:0})} getAdditionalReceivedValues={()=>({mls:0,bottles:0})} getOutstandingValues={()=>({mls:-38,bottles:0})} consumption={values} patients={{jodascan300:0,hexopack350:0,gastrolux:0,mriContrast:0}} onReceivedChange={noop} onAdditionalReceivedChange={noop} onConsumptionChange={noop} onPatientsChange={noop} />);
    const computed=Array.from(container.querySelectorAll('input[readonly]')).map(input=>(input as HTMLInputElement).value);
    expect(computed).toContain('5.14');
    expect(computed).toContain('2.533');
    expect(container.querySelectorAll('.stock-negative').length).toBeGreaterThan(0);
  });
});
