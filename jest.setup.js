// eslint-disable-next-line no-unused-vars
import 'isomorphic-fetch';
import './styles/globals.css';
import '@testing-library/jest-dom';
import { enableFetchMocks } from 'jest-fetch-mock';
// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom

window.matchMedia = (query) => ({
   matches: false,
   media: query,
   onchange: null,
   addListener: jest.fn(), // deprecated
   removeListener: jest.fn(), // deprecated
   addEventListener: jest.fn(),
   removeEventListener: jest.fn(),
   dispatchEvent: jest.fn(),
});

global.ResizeObserver = require('resize-observer-polyfill');

// jsdom no trae TextEncoder/TextDecoder y msw (usado en los tests de hooks) los necesita.
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

// msw carga sus módulos de WebSockets y SSE aunque los tests no los usen, y jsdom no expone estos globales de Node.
const { BroadcastChannel } = require('worker_threads');
const { ReadableStream, WritableStream, TransformStream } = require('stream/web');

global.BroadcastChannel = global.BroadcastChannel || BroadcastChannel;
global.ReadableStream = global.ReadableStream || ReadableStream;
global.WritableStream = global.WritableStream || WritableStream;
global.TransformStream = global.TransformStream || TransformStream;

// Enable Fetch Mocking
enableFetchMocks();
