import Papa from 'papaparse';

export interface ASData {
  receiptNumber: string; // A: 접수번호
  visitCount: number; // B: 방문횟수
  receiptDate: Date | null; // C: 접수일자
  finalActionDate: Date | null; // D: 최종조치일
  leadTime: number; // E: 리드타임
  avgLeadTime: number; // F: 평균리드타임
  nthVisitStatus: string; // G: N차 여부
  engineerType: string; // H: 엔지니어 구분
  graphDonut: string; // (그래프용)도넛
}

export interface InconvenienceData {
  referenceMonth: Date | null;
  inconvenienceIndex: number;
  verification: boolean;
}

export interface ASTravelExpenseData {
  receiptMonth: Date | null;
  freeCases: number;
  freeNthCases: number;
  freeTravelExpense: number;
  nthTravelExpenseRatio: number;
  totalTravelExpense: number;
}

const SHEET_ID = '1u_On380lshvKgVVl5XTE57PGaD1VH_Fo_Nyp29uuN-c';
const GID = '2071842067';
const INCONVENIENCE_GID = '91686959';
const SEOUL_GYEONGIN_GID = '141035174';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const INCONVENIENCE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${INCONVENIENCE_GID}`;
const SEOUL_GYEONGIN_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SEOUL_GYEONGIN_GID}`;

const AS_TRAVEL_EXPENSE_SHEET_ID = '1YDoNUcSw8_6YSDX5kuXI0waFzF4fAucwzC64ng-bbjA';
const AS_TRAVEL_EXPENSE_GID = '1632176056';
const AS_TRAVEL_EXPENSE_CSV_URL = `https://docs.google.com/spreadsheets/d/${AS_TRAVEL_EXPENSE_SHEET_ID}/export?format=csv&gid=${AS_TRAVEL_EXPENSE_GID}`;

export const fetchASData = async (): Promise<ASData[]> => {
  try {
    const response = await fetch(`${CSV_URL}&t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch data from Google Sheets');
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData: ASData[] = results.data.map((row: any) => {
            // Helper to parse date strings like "2024-01-01" or "2024. 1. 1"
            const parseDate = (dateStr: string) => {
              if (!dateStr) return null;
              // Handle "2024. 1. 1." format (trailing dot)
              let cleanDateStr = dateStr.trim();
              if (cleanDateStr.endsWith('.')) {
                cleanDateStr = cleanDateStr.slice(0, -1);
              }
              // Replace dots with dashes and remove spaces
              cleanDateStr = cleanDateStr.replace(/\./g, '-').replace(/ /g, '');
              
              const date = new Date(cleanDateStr);
              return isNaN(date.getTime()) ? null : date;
            };

            return {
              receiptNumber: row['접수번호'] || '',
              visitCount: parseInt(row['방문횟수'] || '0', 10),
              receiptDate: parseDate(row['접수일자']),
              finalActionDate: parseDate(row['최종조치일']),
              leadTime: parseInt(row['리드타임'] || '0', 10),
              avgLeadTime: parseFloat(row['평균리드타임'] || '0'),
              nthVisitStatus: row['N차 여부'] || '',
              engineerType: row['엔지니어 구분'] || '',
              graphDonut: row['(그래프용)도넛'] || '',
            };
          });
          resolve(parsedData);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
};

export const fetchSeoulGyeonginData = async (): Promise<ASData[]> => {
  try {
    const response = await fetch(`${SEOUL_GYEONGIN_CSV_URL}&t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Seoul/Gyeongin data from Google Sheets');
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData: ASData[] = results.data.map((row: any) => {
            const parseDate = (dateStr: string) => {
              if (!dateStr) return null;
              let cleanDateStr = dateStr.trim();
              if (cleanDateStr.endsWith('.')) {
                cleanDateStr = cleanDateStr.slice(0, -1);
              }
              cleanDateStr = cleanDateStr.replace(/\./g, '-').replace(/ /g, '');
              const date = new Date(cleanDateStr);
              return isNaN(date.getTime()) ? null : date;
            };

            // Handle "평균\n리드타임" or "평균 리드타임"
            const avgLeadTimeVal = row['평균\n리드타임'] || row['평균 리드타임'] || '0';

            return {
              receiptNumber: row['접수번호'] || '',
              visitCount: parseInt(row['방문횟수'] || '0', 10),
              receiptDate: parseDate(row['접수일자']),
              finalActionDate: parseDate(row['최종조치일']),
              leadTime: parseInt(row['리드타임'] || '0', 10),
              avgLeadTime: parseFloat(avgLeadTimeVal),
              nthVisitStatus: row['N차 여부'] || '',
              engineerType: row['1차 종결 서비스팀'] || '',
              graphDonut: row['(그래프용)도넛'] || '',
            };
          });
          resolve(parsedData);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching Seoul/Gyeongin data:', error);
    return [];
  }
};

export const fetchInconvenienceData = async (): Promise<InconvenienceData[]> => {
  try {
    const response = await fetch(`${INCONVENIENCE_CSV_URL}&t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch inconvenience data from Google Sheets');
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData: InconvenienceData[] = results.data.map((row: any) => {
             const parseDate = (dateStr: string) => {
              if (!dateStr) return null;
              let cleanDateStr = dateStr.trim();
              if (cleanDateStr.endsWith('.')) {
                cleanDateStr = cleanDateStr.slice(0, -1);
              }
              cleanDateStr = cleanDateStr.replace(/\./g, '-').replace(/ /g, '');
              const date = new Date(cleanDateStr);
              return isNaN(date.getTime()) ? null : date;
            };

            return {
              referenceMonth: parseDate(row['기준년월']),
              inconvenienceIndex: parseFloat(row['고객 불편지수'] || '0'),
              verification: row['검증'] === 'TRUE',
            };
          });
          resolve(parsedData);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching inconvenience data:', error);
    return [];
  }
};

export const fetchASTravelExpenseData = async (): Promise<ASTravelExpenseData[]> => {
  try {
    const response = await fetch(`${AS_TRAVEL_EXPENSE_CSV_URL}&t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch AS travel expense data from Google Sheets');
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData: ASTravelExpenseData[] = [];
          
          results.data.forEach((row: any) => {
            const dateStr = row[0] as string;
            // Assuming the date column starts with '20' (e.g., 2024-01)
            if (!dateStr || !dateStr.startsWith('20')) return;

            const parseDate = (dStr: string) => {
              let cleanDateStr = dStr.trim();
              if (cleanDateStr.endsWith('.')) cleanDateStr = cleanDateStr.slice(0, -1);
              cleanDateStr = cleanDateStr.replace(/\./g, '-').replace(/ /g, '');
              if (cleanDateStr.length === 7) cleanDateStr += '-01';
              const date = new Date(cleanDateStr);
              return isNaN(date.getTime()) ? null : date;
            };

            const parseNumber = (val: string) => {
              if (!val) return 0;
              const cleanVal = val.replace(/,/g, '').replace(/%/g, '').replace(/원/g, '').trim();
              return parseFloat(cleanVal) || 0;
            };

            parsedData.push({
              receiptMonth: parseDate(dateStr),
              freeCases: parseNumber(row[3]),
              freeNthCases: parseNumber(row[4]),
              freeTravelExpense: parseNumber(row[6]),
              nthTravelExpenseRatio: parseNumber(row[8]),
              totalTravelExpense: parseNumber(row[9]),
            });
          });
          resolve(parsedData);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching AS travel expense data:', error);
    return [];
  }
};
