export const BUSINESS_RULES = {
  pagePrice: 1,
  storyPrice: 25,
};

export const FREE_READER_PAGES = 2;
export const READER_PAGE_COUNT = 6;

export const DEFAULT_READER_PAGES = [
  '<h3>Table of contents</h3><ol><li>Origins and memory</li><li>Leadership and land</li><li>What the elders remember</li><li>The story continues</li></ol>',
  '<h3>Introduction</h3><p>This short introduction is free to read. The pages that follow open the full story one page at a time.</p>',
  '<h3>Origins and memory</h3><p>Long before the archive had a name, stories travelled by voice, drum, and the patient attention of elders.</p>',
  '<h3>Leadership and land</h3><p>Every boundary carried a memory, and every leader inherited a duty to keep that memory alive.</p>',
  '<h3>What the elders remember</h3><p>The details remain vivid because they were repeated with care, across seasons and generations.</p>',
  '<h3>The story continues</h3><p>What is preserved here belongs to a living community and to the readers who carry it forward.</p>',
];

export function getRequiredEnv(
  name: string,
  options: {
    fallback?: string;
    allowFallbackInDevelopment?: boolean;
    defaultMessage?: string;
  } = {}
): string {
  const value = process.env[name]?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (value) {
    return value;
  }

  if (!isProduction && options.allowFallbackInDevelopment && options.fallback) {
    return options.fallback;
  }

  throw new Error(
    options.defaultMessage ?? `${name} is not configured. Set it in .env or the deployment environment.`
  );
}
