class Notion {
  constructor(token) {
    this.token = token;
    this.baseUrl = "https://api.notion.com/v1";
    this.notionVersion = "2022-06-28";
  }

  createPage(obj) {
    const path = "pages";
    return this.request(path, "post", obj);
  }

  getOptions(method, payload) {
    const options = {
      method: method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Notion-Version": this.notionVersion,
      },
      muteHttpExceptions: true,
    };
    if (payload !== undefined && payload !== null) {
      options.payload = JSON.stringify(payload);
    }
    return options;
  }

  request(path, method, payload) {
    const url = `${this.baseUrl}/${path}`;
    const options = this.getOptions(method, payload);
    const res = UrlFetchApp.fetch(url, options);
    Logger.log(res.getResponseCode());
    return JSON.parse(res.getContentText());
  }
}

function doGet(e) {
  sendToNotion();
  return ContentService.createTextOutput("実行完了しました。");
}

function sendToNotion() {
  const props = PropertiesService.getScriptProperties();
  const notion = new Notion(props.getProperty("NOTION_TOKEN"));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // IFTTTから転送されたデータが保存されるシート
  const newTaskSheet = ss.getSheetByName('new_tasks');

  // 送信完了したタスクを保存するシート
  // スプレッドシートの上限に引っかかるので転送しないほうがいいかも？
  const transferredSheet = ss.getSheetByName('transferred');

  // シートからタスクを取得する
  const newTasks = getNewTasks(newTaskSheet);
  if (newTasks === null) { // タスクがなかったら終了
    return null;
  }

  // 1行ずつFormatして送信する
  for (const row of newTasks) {
    const data = rowToJson(row);
    const pageObj = generatePageObj(data, props.getProperty("DATABASE_ID"));
    const res = notion.createPage(pageObj);

    // 送信済みシートに移動する
    transferredSheet.appendRow(row);

    if (res["object"] === "error") {
      sendErrorMail(props.getProperty("MAIL_ADDRESS"), data, res);
    }
  }

  // 送信完了したらタスクシートを削除する
  clearSheetButKeepHeaders(newTaskSheet);
}

function getNewTasks(sheet) {
  const COLUMN_LENGTH = 10;
  const START_ROW = 2;

  const lastRow = sheet.getLastRow();
  if (lastRow === 1) { // タスクがない場合
    return null;
  }

  const values = sheet.getRange(START_ROW, 1, lastRow - 1, COLUMN_LENGTH).getValues();
  return values;
}

function clearSheetButKeepHeaders(sheet) {
  const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()); range.clearContent();
  range.clearContent();
}

function rowToJson(row) {
  return {
    TaskName: row[0],
    TaskContent: row[1],
    CompleteDate: row[2],
    StartDate: row[3],
    EndDate: row[4],
    List: row[5],
    Priority: row[6],
    Tag: row[7],
    LinkToTask: row[8],
    CreatedAt: row[9],
  }
}

function sendErrorMail(address, data, res) {
  const recipient = address;
  const subject = "[ERROR] Notion API Error";
  const body = [
    'There is an error in GAS Web API "TickTick to Notion".\n',
    `[TaskName] : ${data.TaskName}`,
    `[CompleteDate] : ${data.CompleteDate}`,
    `[List] : ${data.List}`,
    `[Link] : ${data.LinkToTask}`,
    "[Response] :",
    JSON.stringify(res),
  ].join("\n");
  const options = { name: "TickTick to Notion" };
  GmailApp.sendEmail(recipient, subject, body, options);
}

function generatePageObj(data, databaseId) {
  let obj = {
    parent: { database_id: databaseId },
    properties: {
      TaskName: {
        title: [{ text: { content: data.TaskName } }],
      },
      TaskContent: {
        rich_text: [{ text: { content: formatContent(data.TaskContent) } }],
      },
      CompleteDate: {
        date: { start: formatDate(data.CompleteDate) },
      },
      List: {
        select: { name: data.List },
      },
      Priority: {
        select: { name: data.Priority },
      },
      LinkToTask: {
        url: data.LinkToTask,
      },
      CreatedAt: {
        date: { start: formatDate(data.CreatedAt) },
      },
    },
  };
  obj = addTag(obj, data.Tag);
  obj = addDate(obj, data.StartDate, "StartDate");
  obj = addDate(obj, data.EndDate, "EndDate");
  obj = addContent(obj, data.TaskContent, "---");
  return obj;
}

function addContent(obj, taskContentData, separator) {
  if (taskContentData == "") {
    return obj;
  }
  const fmtTaskContent = formatContent(taskContentData);
  const contents = fmtTaskContent.split("\n");
  const children = [];
  let isTodo = false;
  for (let index = 0; index < contents.length; index++) {
    const line = contents[index];
    if (line === separator) {
      isTodo = true;
      if (index > 0) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [] },
        });
      }
    } else if (!isTodo) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
      });
    } else {
      children.push({
        object: "block",
        type: "to_do",
        to_do: { rich_text: [{ type: "text", text: { content: line } }], checked: true },
      });
    }
  }
  obj.children = children;
  return obj;
}

function formatContent(taskContentData) {
  return taskContentData.replace(/^\n|\n$/g, "");
}

function addTag(obj, tagData) {
  const tags = [];
  const tagsData = tagData.split(" ");
  tagsData.forEach(tag => {
    if (tag.length > 0) {
      const fmtTag = tag.replace("#", "");
      tags.push({ name: fmtTag });
    }
  });
  if (tags.length > 0) {
    obj.properties.Tag = { multi_select: tags };
  }
  return obj;
}

function addDate(obj, dateData, key) {
  if (dateData.length > 0) {
    obj["properties"][key] = { date: { start: formatDate(dateData) } };
  }
  return obj;
}

function formatDate(dateData) {
  const dateArr = dateData.split(" ");
  const year = dateArr[2];
  const month = convertMonth(dateArr[0]);
  const day = ("0" + dateArr[1].replace(",", "")).slice(-2);
  if (dateArr.indexOf("at") < 0) {
    return `${year}-${month}-${day}`;
  }

  const timeArr = dateArr[4].replace("AM", ":AM").replace("PM", ":PM").split(":");
  const hour = convertHour(timeArr[0], timeArr[2]);
  const min = timeArr[1];
  const timezone = "+09:00";
  return `${year}-${month}-${day}T${hour}:${min}:00.000${timezone}`;
}

function convertMonth(monthString) {
  const months = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };
  return months[monthString];
}

function convertHour(hourString, ampm) {
  let ret = hourString.replace("12", "00");
  if (ampm == "PM") {
    ret = String(Number(ret) + 12);
  }
  return ret;
}
