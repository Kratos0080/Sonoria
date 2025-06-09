// A simple test file to verify our testing setup
// import React from 'react'; // Removed unused import
// import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Simple Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
}); 