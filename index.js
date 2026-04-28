#! /usr/bin/env node

// config wizard for micli
// Geminiさんありがとう

import { parseArgs } from 'node:util';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";

const rl = readline.createInterface({ input, output });

const version = '0.1.0';
const path2env = '~/.config/micli/env.json'
const cr = `
` // '\n'

const usage = `
Configure wizard for micli-* commands v${version}

Usage: $ micli-cfg [options]

  -e <path_to_file>: Specify a path to the environment file
                     (default = ~/.config/micli/env.json)

  -l <language_name>: Specify a language for interaction (default = en)
    * en: English
    * jp: Japanese
`;

const options = {
  env: { type: 'string', short: 'e' },
  lang: { type: 'string', short: 'l' },
};

const { values: args } = parseArgs({ options });

const expandPath = path => path.replace(/^~(?=$|\/|\\)/, homedir());

const readEnv = (path) => {
  try {
    const text = readFileSync(path, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    console.error(`failed to read env file: `, err.message);
    process.exit(1);
  }
};

const writeEnv = (path, env) => {
  const dir = dirname(path);
  
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(env, null, 2));
  } catch (err) {
    console.error(`failed to write env file: `, err.message);
    process.exit(1);
  }
};

const checkMiauthToken = async (host, session) => {
  const url = `https://${host}/api/miauth/${session}/check`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`API Error (${res.status}): ${errorBody}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Failed to request to the Misskey server: ', err.message);
    process.exit(1);
  }
};

const main = async () => {
  const path = expandPath(args.env || path2env);
  const env = existsSync(path) ? readEnv(path) : { profiles: [] };
  const lang = args.lang || 'en';

  const hello = {
    en: `The tool's language is set to "English". Continue? (y/n): `,
    jp: `言語設定は「日本語」です。続行しますか？ (y/n): `
  };

  console.log(usage);

  const ans = await rl.question(hello[lang]);
  if (ans.toLowerCase() !== 'y') {
    process.exit(0);
  }

  const profile = {
    name: '',
    server: '',
    token: ''
  };

  const askName = {
    en: 'Profile name to configure: ',
    jp: '設定するプロファイルの名前 (アルファベットで): '
  };

  while (profile.name === '') {
    profile.name = await rl.question(askName[lang]);
  }

  const askServer = {
    en: `Server's domain name: `,
    jp: `サーバのドメイン名: `,
  };

  while (profile.server === '') {
    profile.server = await rl.question(askServer[lang]);
  }

  const perms = [
    'read:account',
    'read:messaging',
    'write:messaging',
    'read:reaction',
    'write:reaction',
    'read:federation'
  ].join(',');

  const sessionId = randomUUID();
  const authUrl = `https://${profile.server}/miauth/${sessionId}?name=micli&permission=${perms}`;

  const plzAuth = {
    en: `Access this URL to get authorize, and when finish it, input "y":${cr}${authUrl}${cr}`,
    jp: `以下のURLから認証を行い、それが終わったら"y"と入力してください:${cr}${authUrl}${cr}`
  };

  let confirmAuth = '';
  while (confirmAuth.toLowerCase() !== 'y') {
    confirmAuth = await rl.question(plzAuth[lang]);
  }

  const check = await checkMiauthToken(profile.server, sessionId);
  profile.token = check.token;

  const target = env.profiles.findIndex(p => p.name === profile.name);
  if (target !== -1) {
    env.profiles[target].server = profile.server;
    env.profiles[target].token = profile.token;
  } else {
    env.profiles.push(profile);
  }

  writeEnv(path, env);
  console.log(`[ OK ] Saved the profile for user @${check.user.username}@${profile.server}, have fun!`);
  rl.close();
};

main();



