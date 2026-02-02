import OpenAI from 'openai';
import * as XLSX from 'xlsx';

// Lazy initialization to ensure env variables are loaded
let openAIClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  try {
    if (!openAIClient) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      openAIClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return openAIClient as OpenAI;
  } catch (error) {
    console.log(error);
    throw new Error('Failed to get OpenAI client');
  }
}


const systemPrompt = `You are a construction site execution assistant.

Your job is to extract executable site actions from BOQ text.

Rules:
- Return ONLY a JSON array of strings
- Each string must be a clear site action
- Use simple construction language
- Do NOT include quantities, units, materials, brands, or standards
- Do NOT invent actions not explicitly implied
- If actions are normally done together on site, keep them as ONE action
- Keep descriptions short and concise

Follow the following format strictly: [{"task":"task1", "description":"description" , "subTasks":[{"taskTitle":"taskTitile", "description":"description"}]},...]
`;

export const generateTasksFromBoq = async (groupedBoq: any) => {
  try {
    const userPrompt = `Extract executable site tasks and sub-tasks from the following BOQ groups: ${JSON.stringify(
      groupedBoq
    )}. 

Make sure to:
- Include all the tasks and sub-tasks from the BOQ groups
- Skip duplicates
- Break the tasks and sub-tasks into smaller chunks if they are too long
- Keep the order of the tasks and sub-tasks as they are in the BOQ groups
- Keep the descriptions short and concise
- Return ONLY valid JSON

Follow the following format strictly: [{"task":"task1", "description":"description" , "subTasks":[{"taskTitle":"taskTitile", "description":"description"},{"taskTitle":"taskTitile", "description":"description"}]},...]`;

    const client = getOpenAIClient();
    const response: any = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    const textBlock = response.output?.[0]?.content?.find(
      (c: any) => c.type === 'output_text'
    );

    if (!textBlock) {
      throw new Error('AI did not return text output');
    }

    return JSON.parse(textBlock.text);
  } catch (err) {
    console.log(err);
    return { message: 'Failed to generate tasks', error: err };
  }
};

export type ExcelRowJson = {
  SlNo: string | null;
  Code: string | null;
  Description: string | null;
  Location: string | null;
  Unit: string | null;
  Quantity: number | string | null;
  Rate: number | string | null;
  Amount: number | string | null;
  Remarks: string | null;
  Extra: string[];
};

function clean(value: any): string | null {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v.length ? v : null;
}

export function convertExcelToJson(fileBuffer: Buffer): any {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  //   console.log(workbook, 'workbook');
  const sheet = Object.values(workbook.Sheets)[0];
  //   console.log(workbook.Sheets, 'sheet');

  const rows = XLSX.utils.sheet_to_json<any>(sheet, {
    defval: '',
  });
  //   console.log(rows, 'rows');
  return rows.map((row) => {
    const extra: string[] = [];

    Object.keys(row).forEach((key) => {
      if (key.startsWith('__EMPTY')) {
        const v = clean(row[key]);
        if (v) extra.push(v);
      }
    });

    return {
      SlNo:
        clean(row[' Sl. No']) || clean(row['Sl. No']) || clean(row['Sl.No']),
      Code: clean(row[' Code']),
      Description: clean(row[' Description']),
      Location: clean(row['Location']),
      Unit: clean(row[' Unit']),
      Quantity: row['Quantity'] ?? null,
      Rate: row['Rate'] ?? null,
      Amount: row['Amount'] ?? null,
      Remarks: clean(row[' Remarks ']),
      Extra: extra,
    };
  });
}

type RawRow = {
  SlNo: string | null;
  Code: string | null;
  Description: string | null;
  Location: string | null;
  Unit: string | null;
  Quantity: any;
  Rate: any;
  Amount: any;
  Remarks: string | null;
  Extra: string[];
};

type GroupedBOQ = {
  slNo: string;
  title: string | null;
  unit: string | null;
  quantity: any;
  rows: any[];
};

export function groupBoqRows(rows: RawRow[]): GroupedBOQ[] {
  const result: GroupedBOQ[] = [];
  let current: GroupedBOQ | null = null;

  for (const row of rows) {
    const sl = row.SlNo?.trim();

    // 🔹 CASE 1: New numeric Sl.No (parent item)
    if (sl && /^\d+$/.test(sl)) {
      current = {
        slNo: sl,
        title: row.Description,
        unit: row.Unit ?? null,
        quantity: row.Quantity ?? null,
        rows: [],
      };
      result.push(current);
      continue;
    }

    // 🔹 CASE 2: Alphabetic sub-item (a, b, c)
    if (sl && /^[a-zA-Z]$/.test(sl) && current) {
      current.rows.push({
        type: 'subItem',
        code: sl,
        title: row.Description,
        location: row.Location,
        unit: row.Unit,
        quantity: row.Quantity,
        remarks: row.Remarks,
      });
      continue;
    }

    // 🔹 CASE 3: Normal continuation / description row
    if (current) {
      current.rows.push({
        type: 'description',
        text: row.Description,
        location: row.Location,
        remarks: row.Remarks,
        extra: row.Extra,
      });
    }
  }

  return result;
}
