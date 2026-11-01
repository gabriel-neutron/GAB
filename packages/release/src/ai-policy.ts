/** The policy of the operator for the crawlers of AI systems. Change this one line to change the
 * policy of `robots.txt` and the words of the page "AI use" together.
 * `allow`: an AI system may read the site. It must cite the claim that it uses.
 * `disallow`: the known AI crawlers may not read the site. */
export const AI_CRAWLER_POLICY: AiPolicy = 'allow';

export type AiPolicy = 'allow' | 'disallow';

/** The known crawlers and agents of AI systems, by the name in their user agent. A search engine
 * crawler is not in this list: the policy does not apply to it. */
export const AI_CRAWLERS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent',
  'Bytespider',
  'Amazonbot',
  'cohere-ai',
  'MistralAI-User',
  'DuckAssistBot',
];
