export interface StepStrings {
  emoji: string;
  title: string;
  subtitle: string;
  body?: string[];
}

export interface I18nStrings {
  welcome: { title: string; subtitle: string };
  step1: StepStrings;
  step2: StepStrings;
  step3: StepStrings;
  step4: StepStrings;
  step5: StepStrings;
  step6: StepStrings;
  appId: string;
  appCert: string;
  customerId: string;
  customerSecret: string;
  credentialsSaved: string;
  alreadyConfigured: string;
  asrProvider: string;
  asrRecommend: string;
  language: string;
  asrConfigured: string;
  llmProvider: string;
  apiKey: string;
  model: string;
  llmConfigured: string;
  ttsProvider: string;
  ttsApiKey: string;
  groupId: string;
  ttsConfigured: string;
  launchMode: string;
  launchConvoai: string;
  launchOpenclaw: string;
  verifying: string;
  verified: string;
  starting: string;
  agentLive: string;
  voiceLive: string;
  browserHint: string;
  enterHint: string;
  sessionComplete: string;
  viewReport: string;
  complete: string;
}

const cn: I18nStrings = {
  welcome: { title: 'Welcome / \u6B22\u8FCE', subtitle: 'Choose your platform to get started' },

  step1: {
    emoji: '\uD83D\uDD11',
    title: '\u914D\u7F6E\u51ED\u8BC1',
    subtitle: '',
    body: [
      '\u8BF7\u6309\u4EE5\u4E0B\u6B65\u9AA4\u83B7\u53D6\u51ED\u8BC1\uFF1A',
      '',
      '\u2460 \u6253\u5F00\u58F0\u7F51\u63A7\u5236\u53F0\u5E76\u521B\u5EFA\u9879\u76EE',
      '  console.shengwang.cn/overview',
      '  \u521B\u5EFA\u9879\u76EE\uFF0C\u786E\u4FDD\u5F00\u901A RTM \u670D\u52A1',
      '',
      '\u2461 \u5728\u603B\u89C8\u9875\u627E\u5230\u9879\u76EE\u7684 App ID \u548C\u8BC1\u4E66',
      '  \u603B\u89C8 \u2192 \u9879\u76EE\u4FE1\u606F \u2192 App ID / App \u8BC1\u4E66',
      '',
      '\u2462 \u786E\u4FDD\u5BF9\u8BDD\u5F0F AI \u5F15\u64CE\u5DF2\u5F00\u901A',
      '  console-conversationai.shengwang.cn',
      '  \u68C0\u67E5\u670D\u52A1\u5F00\u901A\u72B6\u6001',
      '',
      '\u2463 \u83B7\u53D6 RESTful API \u5BC6\u94A5',
      '  console.shengwang.cn/settings/restfulApi',
      '  \u6DFB\u52A0\u5BC6\u94A5 \u2192 \u4E0B\u8F7D\u6587\u4EF6 \u2192 \u627E\u5230\uFF1A',
      '  \u5BA2\u6237 ID (Key) + \u5BA2\u6237\u5BC6\u94A5 (Secret)',
    ],
  },
  step2: { emoji: '\uD83C\uDF99', title: '\u8BED\u97F3\u8BC6\u522B', subtitle: '\u9009\u62E9 Agent \u542C\u7684\u61C2\u4EC0\u4E48\u8BED\u8A00' },
  step3: { emoji: '\uD83E\uDDE0', title: '\u5927\u8BED\u8A00\u6A21\u578B', subtitle: '\u9009\u62E9 Agent \u7684\u5927\u8111' },
  step4: { emoji: '\uD83D\uDD0A', title: '\u8BED\u97F3\u5408\u6210', subtitle: '\u9009\u62E9 Agent \u7684\u58F0\u97F3' },
  step5: { emoji: '\u26A1', title: '\u542F\u52A8\u8BED\u97F3 Agent', subtitle: '\u4E00\u5207\u5C31\u7EEA\uFF0C\u51C6\u5907\u5F00\u59CB\u5BF9\u8BDD' },
  step6: { emoji: '\u2705', title: '\u5BF9\u8BDD\u5B8C\u6210', subtitle: '\u67E5\u770B\u672C\u6B21\u5BF9\u8BDD\u7684\u8D28\u91CF\u62A5\u544A' },

  appId: 'App ID',
  appCert: 'App \u8BC1\u4E66',
  customerId: '\u5BA2\u6237 ID (Key)',
  customerSecret: '\u5BA2\u6237\u5BC6\u94A5 (Secret)',
  credentialsSaved: '\u51ED\u8BC1\u5DF2\u4FDD\u5B58',
  alreadyConfigured: '\u5DF2\u914D\u7F6E',
  asrProvider: '\u8BED\u97F3\u8BC6\u522B\u670D\u52A1',
  asrRecommend: '\u58F0\u7F51\u5185\u7F6E\uFF0C\u65E0\u9700\u989D\u5916 Key\uFF08\u63A8\u8350\uFF09',
  language: '\u5BF9\u8BDD\u8BED\u8A00',
  asrConfigured: '\u8BED\u97F3\u8BC6\u522B\u5DF2\u914D\u7F6E',
  llmProvider: '\u5927\u6A21\u578B\u670D\u52A1\u5546',
  apiKey: 'API Key',
  model: '\u6A21\u578B',
  llmConfigured: '\u5927\u6A21\u578B\u5DF2\u914D\u7F6E',
  ttsProvider: '\u8BED\u97F3\u5408\u6210\u670D\u52A1',
  ttsApiKey: 'TTS API Key',
  groupId: 'Group ID',
  ttsConfigured: '\u8BED\u97F3\u5408\u6210\u5DF2\u914D\u7F6E',
  launchMode: '\u542F\u52A8\u65B9\u5F0F',
  launchConvoai: 'ConvoAI Agent \u2014 \u521B\u5EFA\u65B0\u7684\u8BED\u97F3 AI \u52A9\u624B',
  launchOpenclaw: '\uD83E\uDD9E OpenClaw \u2014 \u8BA9\u672C\u5730 OpenClaw \u53D8\u6210\u8BED\u97F3\u52A9\u624B',
  verifying: '\u6B63\u5728\u9A8C\u8BC1\u51ED\u8BC1...',
  verified: '\u51ED\u8BC1\u9A8C\u8BC1\u901A\u8FC7',
  starting: '\u6B63\u5728\u542F\u52A8\u8BED\u97F3 Agent...',
  agentLive: 'Agent \u5DF2\u4E0A\u7EBF!',
  voiceLive: '\uD83C\uDF99  \u8BED\u97F3\u5BF9\u8BDD\u5DF2\u5F00\u542F\uFF01',
  browserHint: '\u6D4F\u89C8\u5668\u5DF2\u6253\u5F00 \u2014 \u5141\u8BB8\u9EA6\u514B\u98CE\u540E\u5373\u53EF\u5F00\u59CB\u5BF9\u8BDD',
  enterHint: '\u6309 Enter \u67E5\u770B\u5BF9\u8BDD\u62A5\u544A \u00B7 Ctrl+C \u9000\u51FA',
  sessionComplete: '\u5BF9\u8BDD\u5B8C\u6210',
  viewReport: '\u67E5\u770B\u672C\u6B21\u5BF9\u8BDD\u7684\u8D28\u91CF\u62A5\u544A',
  complete: '\u2714 \u5B8C\u6210\uFF01',
};

const global: I18nStrings = {
  welcome: { title: 'Welcome / \u6B22\u8FCE', subtitle: 'Choose your platform to get started' },

  step1: {
    emoji: '\uD83D\uDD11',
    title: 'Credentials',
    subtitle: '',
    body: [
      'Get the following from console.agora.io:',
      '\u2192 App ID & App Certificate (Project)',
      '\u2192 Customer ID & Secret (RESTful API)',
      '\u2192 Enable ConvoAI service',
    ],
  },
  step2: { emoji: '\uD83C\uDF99', title: 'Speech Recognition', subtitle: 'Choose what language Agent understands' },
  step3: { emoji: '\uD83E\uDDE0', title: 'LLM', subtitle: "Choose Agent's brain" },
  step4: { emoji: '\uD83D\uDD0A', title: 'Text-to-Speech', subtitle: "Choose Agent's voice" },
  step5: { emoji: '\u26A1', title: 'Launch Agent', subtitle: "Everything ready, let's talk" },
  step6: { emoji: '\u2705', title: 'Session Complete', subtitle: 'View your conversation report' },

  appId: 'App ID',
  appCert: 'App Certificate',
  customerId: 'Customer ID',
  customerSecret: 'Customer Secret',
  credentialsSaved: 'Credentials saved.',
  alreadyConfigured: 'Already configured',
  asrProvider: 'ASR provider',
  asrRecommend: 'Built-in, no extra Key (recommended)',
  language: 'Language',
  asrConfigured: 'ASR configured',
  llmProvider: 'LLM provider',
  apiKey: 'API Key',
  model: 'Model',
  llmConfigured: 'LLM configured',
  ttsProvider: 'TTS provider',
  ttsApiKey: 'TTS API Key',
  groupId: 'Group ID',
  ttsConfigured: 'TTS configured',
  launchMode: 'Launch mode',
  launchConvoai: 'ConvoAI Agent \u2014 Create a new voice AI assistant',
  launchOpenclaw: '\uD83E\uDD9E OpenClaw \u2014 Voice-enable your local OpenClaw',
  verifying: 'Verifying credentials...',
  verified: 'Credentials verified.',
  starting: 'Starting voice Agent...',
  agentLive: 'Agent is live!',
  voiceLive: '\uD83C\uDF99  Voice chat is live!',
  browserHint: 'Browser opened \u2014 allow microphone to start talking.',
  enterHint: 'Press Enter for report \u00B7 Ctrl+C to exit',
  sessionComplete: 'Session Complete',
  viewReport: 'View your conversation report',
  complete: '\u2714 Complete!',
};

export function getStrings(lang: 'cn' | 'global'): I18nStrings {
  return lang === 'cn' ? cn : global;
}
