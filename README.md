# Readme

IFTTTのWebhookがFreePlanだと利用できなくなっていた。  
そのため、TickTick→IFTTT→Google Spreadsheet→GAS→Notionで対応。  

## IFTTT

### トリガーの設定

TickTick の「New completed task」をトリガーに設定する。
アカウントを連携して、以下を設定する。

| Item     | Value         |
| -------- | ------------- |
| List     | All Lists     |
| Tag      | All Tags      |
| Priority | Please Select |

### アクションの設定

Google Spreadsheet の「Add row to spreadsheet」をアクションに設定する。

Formatted rowを以下のように設定する。  
※この順番でスプレッドシートのカラムが作成されるので順番が変わると正しく動作しない。

```{{TaskName}} ||| {{TaskContent}} ||| {{CompleteDate}} ||| {{StartDate}} ||| {{EndDate}} ||| {{List}} ||| {{Priority}} ||| {{Tag}} ||| {{LinkToTask}} ||| {{CreatedAt}}```

## GAS
1. 仮でTickTickからタスクを完了させて、IFTTTにスプレッドシートを作成してもらう
1. IFTTTが作成したスプレッドシートにclaspでpush
1. GASでスクリプトプロパティを設定。※keigoh4315さんのReadme参照
1. GASでトリガーを設定※変更のトリガーだと誤動作対策が難しいので、時間トリガーを設定する
1. 任意：Webアプリとしてデプロイすれば任意のタイミングで取り込みを実行できる


## 備考

Notionに転送したデータはtransferredシートに残すようにしているが、件数が多くなってきた場合動作しない可能性があるので要検討

# 以下keigoh4315さんのReadme

# Recording tasks from TickTick to Notion

[![clasp](https://img.shields.io/badge/built%20with-clasp-4285f4.svg)](https://github.com/google/clasp)

タスク管理アプリ TickTick で完了したタスクを Notion に記録する GAS プロジェクトのプログラムです。
This is a program of the GAS project that records tasks completed by the task management application TickTick in Notion.

TickTick のタスク完了をトリガーとして IFTTT に設定し、Webhook を使用してこの GAS プロジェクトに通知します。
Set IFTTT to trigger TickTick task completion and use Webhooks to notify this GAS project.

## Notion

1. Notion API のインテグレーションを作成する。
2. タスクを記録するためのデータベースを作成する。
3. 作成したデータベースにインテグレーションを追加する。

データベースのプロパティには以下を設定する。

| Name         | Type           |
| ------------ | -------------- |
| TaskName     | ページタイトル |
| TaskContent  | テキスト       |
| CompleteDate | 日付           |
| StartDate    | 日付           |
| EndDate      | 日付           |
| List         | セレクト       |
| Priority     | セレクト       |
| Tag          | マルチセレクト |
| LinkToTask   | URL            |
| CreatedAt    | 日付           |

## GAS

GAS プロジェクトのスクリプトプロパティに、以下を設定する。
AUTH_TOKEN には、認証に用いる文字列を自分で用意して設定する。

| Property     | Value                                   |
| ------------ | --------------------------------------- |
| NOTION_TOKEN | Notion インテグレーションのトークン     |
| DATABASE_ID  | Notion データベースのデータベース ID    |
| MAIL_ADDRESS | エラー通知をするための Gmail のアドレス |
| AUTH_TOKEN   | 認証用のトークン                        |

## IFTTT

### トリガーの設定

TickTick の「New completed task」をトリガーに設定する。
アカウントを連携して、以下を設定する。

| Item     | Value         |
| -------- | ------------- |
| List     | All Lists     |
| Tag      | Please Select |
| Priority | Please Select |

### アクションの設定

Webhooks の「Make a web request」をアクションに設定する。
GAS プロジェクトを Web API としてデプロイして、以下を設定する。
authToken には GAS と同じ値を設定する。

| Item         | Value                   |
| ------------ | ----------------------- |
| URL          | デプロイした API の URL |
| Method       | POST                    |
| Content Type | application/json        |
| Body         | 以下の JSON             |

```
{
  "authToken": "",
  "TaskName": "{{TaskName}}",
  "TaskContent": "{{TaskContent}}",
  "CompleteDate": "{{CompleteDate}}",
  "StartDate": "{{StartDate}}",
  "EndDate": "{{EndDate}}",
  "List": "{{List}}",
  "Priority": "{{Priority}}",
  "Tag": "{{Tag}}",
  "LinkToTask": "{{LinkToTask}}",
  "CreatedAt": "{{CreatedAt}}"
}
```
