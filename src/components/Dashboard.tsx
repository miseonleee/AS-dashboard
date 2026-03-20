import React, { useState, useEffect, useMemo } from 'react';
import { fetchASData, fetchInconvenienceData, fetchSeoulGyeonginData, fetchASTravelExpenseData, ASData, InconvenienceData, ASTravelExpenseData } from '../services/googleSheet';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, ComposedChart, Cell, PieChart, Pie, Sector, AreaChart, Area, ReferenceLine
} from 'recharts';
import { RefreshCw, ExternalLink, Calendar, TrendingUp, Users, Clock, AlertCircle, Frown, MapPin, Pen, Save, X } from 'lucide-react';
import { motion } from 'motion/react';
import { format, getYear, getMonth } from 'date-fns';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";

// --- Components ---

const Card = ({ children, className, title, subTitle, action }: { children: React.ReactNode, className?: string, title?: string, subTitle?: string, action?: React.ReactNode }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col", className)}
  >
    {(title || subTitle || action) && (
      <div className="mb-6 flex justify-between items-start">
        <div>
          {title && <h3 className="text-lg font-semibold text-neutral-800">{title}</h3>}
          {subTitle && <p className="text-sm text-neutral-500 mt-1">{subTitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    {children}
  </motion.div>
);

const StatCard = ({ title, value, subValue, icon: Icon, trend }: { title: string, value: string, subValue?: string, icon: any, trend?: 'up' | 'down' | 'neutral' }) => (
  <Card className="relative overflow-hidden">
    <div className="flex justify-between items-start z-10 relative">
      <div>
        <p className="text-neutral-500 text-sm font-medium mb-1">{title}</p>
        <h4 className="text-3xl font-bold text-neutral-900">{value}</h4>
        {subValue && <p className="text-sm text-neutral-400 mt-2">{subValue}</p>}
      </div>
      <div className="p-3 bg-neutral-50 rounded-2xl text-neutral-900">
        <Icon size={24} />
      </div>
    </div>
    {/* Decorative background element */}
    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-neutral-50 to-transparent rounded-full opacity-50" />
  </Card>
);

const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <RefreshCw className="w-10 h-10 text-neutral-900 animate-spin" />
      <p className="text-neutral-600 font-medium">데이터를 불러오는 중...</p>
    </div>
  </div>
);

// --- Main Dashboard ---

export default function Dashboard() {
  const [data, setData] = useState<ASData[]>([]);
  const [seoulGyeonginData, setSeoulGyeonginData] = useState<ASData[]>([]);
  const [inconvenienceData, setInconvenienceData] = useState<InconvenienceData[]>([]);
  const [travelExpenseRawData, setTravelExpenseRawData] = useState<ASTravelExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'inconvenience' | 'national' | 'seoul' | 'travelExpense'>('inconvenience');
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [memoText, setMemoText] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('memo') || "";
    }
    return "";
  });
  const [isEditingMemo, setIsEditingMemo] = useState(false);

  // Sync memo to URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (memoText) {
        url.searchParams.set('memo', memoText);
      } else {
        url.searchParams.delete('memo');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [memoText]);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedAS, fetchedInconvenience, fetchedSeoulGyeongin, fetchedTravelExpense] = await Promise.all([
        fetchASData(),
        fetchInconvenienceData(),
        fetchSeoulGyeonginData(),
        fetchASTravelExpenseData()
      ]);
      
      if (fetchedAS.length === 0) {
        setError("데이터를 불러올 수 없습니다. 구글 시트가 공개되어 있는지 확인해주세요.");
      }
      setData(fetchedAS);
      setInconvenienceData(fetchedInconvenience);
      setSeoulGyeonginData(fetchedSeoulGyeongin);
      setTravelExpenseRawData(fetchedTravelExpense);
    } catch (err) {
      console.error(err);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Data Processing ---

  // Helper for number formatting
  const formatNumber = (num: number) => num.toLocaleString();

  // Filtered data for KPI (Month sensitive)
  const kpiData = useMemo(() => {
    return data.filter(d => {
      if (!d.finalActionDate) return false;
      const year = getYear(d.finalActionDate);
      const month = getMonth(d.finalActionDate) + 1;
      
      if (year !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && month !== selectedMonth) return false;
      return true;
    });
  }, [data, selectedYear, selectedMonth]);

  // Previous Month Data for AI Comparison
  const prevMonthStats = useMemo(() => {
    if (selectedMonth === 'ALL') return null;

    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const prevData = data.filter(d => {
      if (!d.finalActionDate) return false;
      const y = getYear(d.finalActionDate);
      const m = getMonth(d.finalActionDate) + 1;
      return y === prevYear && m === prevMonth;
    });

    if (prevData.length === 0) return null;

    // Calculate stats
    const total = prevData.length;
    
    const validFirstVisit = prevData.filter(d => d.nthVisitStatus && d.nthVisitStatus !== '미방문');
    const firstVisitCount = validFirstVisit.filter(d => d.nthVisitStatus.includes('1차')).length;
    const rate = validFirstVisit.length ? ((firstVisitCount / validFirstVisit.length) * 100).toFixed(1) : '0';

    const validLeadTime = prevData.filter(d => d.leadTime !== undefined && !isNaN(d.leadTime));
    const avgLead = validLeadTime.length ? (validLeadTime.reduce((a, b) => a + b.leadTime, 0) / validLeadTime.length).toFixed(1) : '0';

    return {
      year: prevYear,
      month: prevMonth,
      total,
      rate,
      avgLead
    };
  }, [data, selectedYear, selectedMonth]);

  // 1. Total Action Count
  const totalActionCount = kpiData.length;

  // 2. 1st Visit Completion Rate
  const firstVisitRate = useMemo(() => {
    const validData = kpiData.filter(d => d.nthVisitStatus && d.nthVisitStatus !== '미방문');
    if (validData.length === 0) return 0;
    const firstVisitCount = validData.filter(d => d.nthVisitStatus.includes('1차')).length;
    return ((firstVisitCount / validData.length) * 100).toFixed(1);
  }, [kpiData]);

  // 3. Monthly Avg Lead Time
  const monthlyAvgLeadTime = useMemo(() => {
    const validData = kpiData.filter(d => d.leadTime !== undefined && !isNaN(d.leadTime) && d.leadTime >= 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((acc, curr) => acc + curr.leadTime, 0);
    return (sum / validData.length).toFixed(1);
  }, [kpiData]);


  // --- Chart Data Preparation (Year sensitive, Month insensitive for trends) ---

  const yearData = useMemo(() => {
    return data.filter(d => {
      if (!d.finalActionDate) return false;
      return getYear(d.finalActionDate) === selectedYear;
    });
  }, [data, selectedYear]);

  // Chart 1: Monthly Receipt & Action Counts
  const monthlyCountsData = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      actionCount: 0,
      receiptCount: 0,
    }));

    // Action Counts (based on Final Action Date)
    yearData.forEach(d => {
      if (d.finalActionDate) {
        const month = getMonth(d.finalActionDate);
        counts[month].actionCount++;
      }
    });

    // Receipt Counts (based on Receipt Date) - Need to filter ALL data by selected year's receipt date
    data.forEach(d => {
      if (d.receiptDate && getYear(d.receiptDate) === selectedYear) {
        const month = getMonth(d.receiptDate);
        counts[month].receiptCount++;
      }
    });

    return counts;
  }, [yearData, data, selectedYear]);

  // Chart 2: 1st Visit Completion Rate Trend
  const completionRateTrendData = useMemo(() => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      '1차완결': 0,
      '2차완결': 0,
      '3차이상': 0,
      total: 0
    }));

    yearData.forEach(d => {
      if (d.finalActionDate && d.nthVisitStatus && d.nthVisitStatus !== '미방문') {
        const month = getMonth(d.finalActionDate);
        if (d.nthVisitStatus.includes('1차')) trend[month]['1차완결']++;
        else if (d.nthVisitStatus.includes('2차')) trend[month]['2차완결']++;
        else trend[month]['3차이상']++;
        trend[month].total++;
      }
    });

    return trend.map(t => ({
      name: t.name,
      '1차완결': t.total ? parseFloat(((t['1차완결'] / t.total) * 100).toFixed(1)) : 0,
      '2차완결': t.total ? parseFloat(((t['2차완결'] / t.total) * 100).toFixed(1)) : 0,
      '3차이상': t.total ? parseFloat(((t['3차이상'] / t.total) * 100).toFixed(1)) : 0,
      '1차완결_count': t['1차완결'],
      '2차완결_count': t['2차완결'],
      '3차이상_count': t['3차이상'],
    }));
  }, [yearData]);

  // Chart 3: Engineer Team Performance (Donut) - Uses KPI Data (Month Filtered)
  const engineerPerformanceData = useMemo(() => {
    // Filter conditions:
    // 1. graphDonut field is not empty
    // 2. Only include "시공/CS팀" and "엔지니어팀"
    
    const validData = kpiData.filter(d => {
      const donutValue = d.graphDonut?.trim();
      return donutValue && (donutValue === '시공/CS팀' || donutValue === '엔지니어팀');
    });
    
    let csCount = 0;
    let engineerCount = 0;

    validData.forEach(d => {
      const type = d.graphDonut?.trim();
      if (type === '시공/CS팀') csCount++;
      else if (type === '엔지니어팀') engineerCount++;
    });

    return [
      { name: '시공/CS팀', value: csCount },
      { name: '엔지니어팀', value: engineerCount },
    ].filter(d => d.value > 0).sort((a, b) => b.name.localeCompare(a.name));
  }, [kpiData]);

  // Chart 4: Average Lead Time Trend
  const avgLeadTimeTrendData = useMemo(() => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      sumLeadTime: 0,
      count: 0,
    }));

    yearData.forEach(d => {
      // Exclude negative lead times
      if (d.finalActionDate && d.leadTime !== undefined && !isNaN(d.leadTime) && d.leadTime >= 0) {
        const month = getMonth(d.finalActionDate);
        trend[month].sumLeadTime += d.leadTime;
        trend[month].count++;
      }
    });

    return trend.map(t => ({
      name: t.name,
      avgLeadTime: t.count ? parseFloat((t.sumLeadTime / t.count).toFixed(1)) : 0,
    }));
  }, [yearData]);


  // Chart 5: Inconvenience Index Trend
  const inconvenienceTrendData = useMemo(() => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      sumIndex: 0,
      count: 0,
    }));

    inconvenienceData.forEach(d => {
      // Filter: Year match AND Verification is TRUE
      if (d.referenceMonth && getYear(d.referenceMonth) === selectedYear && d.verification) {
        const month = getMonth(d.referenceMonth);
        trend[month].sumIndex += d.inconvenienceIndex;
        trend[month].count++;
      }
    });

    return trend.map(t => ({
      name: t.name,
      avgIndex: t.count ? parseFloat((t.sumIndex / t.count).toFixed(1)) : 0,
    }));
  }, [inconvenienceData, selectedYear]);

  // --- Seoul/Gyeongin Data Processing ---
  
  // Filtered Seoul/Gyeongin data for KPI (Month sensitive)
  const kpiSeoulData = useMemo(() => {
    return seoulGyeonginData.filter(d => {
      if (!d.finalActionDate) return false;
      const year = getYear(d.finalActionDate);
      const month = getMonth(d.finalActionDate) + 1;
      
      if (year !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && month !== selectedMonth) return false;
      return true;
    });
  }, [seoulGyeonginData, selectedYear, selectedMonth]);

  // Seoul/Gyeongin Year Data (for charts)
  const yearSeoulData = useMemo(() => {
    return seoulGyeonginData.filter(d => {
      if (!d.finalActionDate) return false;
      return getYear(d.finalActionDate) === selectedYear;
    });
  }, [seoulGyeonginData, selectedYear]);

  // KPI 1: Total Action Count
  const seoulTotalActionCount = kpiSeoulData.length;

  // KPI 2: 1st Visit Completion Rate
  const seoulFirstVisitRate = useMemo(() => {
    const validData = kpiSeoulData.filter(d => d.nthVisitStatus && d.nthVisitStatus !== '미방문');
    if (validData.length === 0) return 0;
    const firstVisitCount = validData.filter(d => d.nthVisitStatus.includes('1차')).length;
    return ((firstVisitCount / validData.length) * 100).toFixed(1);
  }, [kpiSeoulData]);

  // KPI 3: Monthly Avg Lead Time
  const seoulMonthlyAvgLeadTime = useMemo(() => {
    const validData = kpiSeoulData.filter(d => d.leadTime !== undefined && !isNaN(d.leadTime) && d.leadTime >= 0);
    if (validData.length === 0) return 0;
    const sum = validData.reduce((acc, curr) => acc + curr.leadTime, 0);
    return (sum / validData.length).toFixed(1);
  }, [kpiSeoulData]);

  // Chart 1: Monthly Receipt & Action Counts (Combo)
  const seoulMonthlyCountsData = useMemo(() => {
    const counts = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      actionCount: 0,
      receiptCount: 0,
    }));

    // Action Counts
    yearSeoulData.forEach(d => {
      if (d.finalActionDate) {
        const month = getMonth(d.finalActionDate);
        counts[month].actionCount++;
      }
    });

    // Receipt Counts (based on Receipt Date)
    seoulGyeonginData.forEach(d => {
      if (d.receiptDate && getYear(d.receiptDate) === selectedYear) {
        const month = getMonth(d.receiptDate);
        counts[month].receiptCount++;
      }
    });

    return counts;
  }, [yearSeoulData, seoulGyeonginData, selectedYear]);

  // Chart 2: 1st Visit Completion Rate Trend (Stacked Bar 100%)
  const seoulCompletionRateTrendData = useMemo(() => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      '1차완결': 0,
      '2차완결': 0,
      '3차이상': 0,
      total: 0
    }));

    yearSeoulData.forEach(d => {
      if (d.finalActionDate && d.nthVisitStatus && d.nthVisitStatus !== '미방문') {
        const month = getMonth(d.finalActionDate);
        if (d.nthVisitStatus.includes('1차')) trend[month]['1차완결']++;
        else if (d.nthVisitStatus.includes('2차')) trend[month]['2차완결']++;
        else trend[month]['3차이상']++;
        trend[month].total++;
      }
    });

    return trend.map(t => ({
      name: t.name,
      '1차완결': t.total ? parseFloat(((t['1차완결'] / t.total) * 100).toFixed(1)) : 0,
      '2차완결': t.total ? parseFloat(((t['2차완결'] / t.total) * 100).toFixed(1)) : 0,
      '3차이상': t.total ? parseFloat(((t['3차이상'] / t.total) * 100).toFixed(1)) : 0,
      '1차완결_count': t['1차완결'],
      '2차완결_count': t['2차완결'],
      '3차이상_count': t['3차이상'],
    }));
  }, [yearSeoulData]);

  // Chart 3: Engineer Team Performance (Donut)
  const seoulEngineerPerformanceData = useMemo(() => {
    // Filter: 1st Visit Completion AND Graph Donut not empty
    const validData = yearSeoulData.filter(d => {
      const status = d.nthVisitStatus?.replace(/\s+/g, '');
      const donutValue = d.graphDonut?.trim();
      return status === '1차종결' && donutValue && (donutValue === '시공/CS팀' || donutValue === '엔지니어팀');
    });
    
    let csCount = 0;
    let engineerCount = 0;

    validData.forEach(d => {
      const type = d.graphDonut?.trim();
      if (type === '시공/CS팀') csCount++;
      else if (type === '엔지니어팀') engineerCount++;
    });

    return [
      { name: '시공/CS팀', value: csCount },
      { name: '엔지니어팀', value: engineerCount },
    ].filter(d => d.value > 0).sort((a, b) => b.name.localeCompare(a.name));
  }, [yearSeoulData]);

  // Chart 4: Average Lead Time Trend (Line)
  const seoulAvgLeadTimeTrendData = useMemo(() => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      sumLeadTime: 0,
      count: 0,
    }));

    yearSeoulData.forEach(d => {
      if (d.finalActionDate && d.leadTime !== undefined && !isNaN(d.leadTime) && d.leadTime >= 0) {
        const month = getMonth(d.finalActionDate);
        trend[month].sumLeadTime += d.leadTime;
        trend[month].count++;
      }
    });

    return trend.map(t => ({
      name: t.name,
      avgLeadTime: t.count ? parseFloat((t.sumLeadTime / t.count).toFixed(1)) : 0,
    }));
  }, [yearSeoulData]);

  // --- Travel Expense Data Processing ---
  const travelExpenseMonthlyData = useMemo(() => {
    const trend = Array.from({ length: 12 }, (_, i) => ({
      name: `${i + 1}월`,
      month: i + 1,
      totalTravelExpense: 0,
      freeCases: 0,
      freeNthCases: 0,
      freeTravelExpense: 0,
      nthTravelExpenseRatio: 0,
    }));

    travelExpenseRawData.forEach(d => {
      if (d.receiptMonth && getYear(d.receiptMonth) === selectedYear) {
        const month = getMonth(d.receiptMonth);
        trend[month].totalTravelExpense += d.totalTravelExpense;
        trend[month].freeCases += d.freeCases;
        trend[month].freeNthCases += d.freeNthCases;
        trend[month].freeTravelExpense += d.freeTravelExpense;
        // Since there is only one row per month, we can just assign the ratio
        trend[month].nthTravelExpenseRatio = d.nthTravelExpenseRatio;
      }
    });

    return trend;
  }, [travelExpenseRawData, selectedYear]);

  const travelExpenseAverages = useMemo(() => {
    let totalExpenseSum = 0, totalExpenseCount = 0;
    let freeCasesSum = 0, freeCasesCount = 0;
    let freeExpenseSum = 0, freeExpenseCount = 0;

    travelExpenseMonthlyData.forEach(d => {
      if (d.totalTravelExpense > 0) { totalExpenseSum += d.totalTravelExpense; totalExpenseCount++; }
      if (d.freeCases > 0) { freeCasesSum += d.freeCases; freeCasesCount++; }
      if (d.freeTravelExpense > 0) { freeExpenseSum += d.freeTravelExpense; freeExpenseCount++; }
    });

    return {
      totalTravelExpense: totalExpenseCount ? Math.round(totalExpenseSum / totalExpenseCount) : 0,
      freeCases: freeCasesCount ? Math.round(freeCasesSum / freeCasesCount) : 0,
      freeTravelExpense: freeExpenseCount ? Math.round(freeExpenseSum / freeExpenseCount) : 0,
    };
  }, [travelExpenseMonthlyData]);

  // --- AI Analysis ---
  useEffect(() => {
    const generateAnalysis = async () => {
        if (!process.env.GEMINI_API_KEY) return;
        setAnalyzing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            
            let comparisonText = "";
            if (prevMonthStats) {
              comparisonText = `
                [전월(${prevMonthStats.month}월) 대비 비교]
                - 총 조치 건수: ${prevMonthStats.total}건 -> ${totalActionCount}건
                - 1차 종결율: ${prevMonthStats.rate}% -> ${firstVisitRate}%
                - 평균 리드타임: ${prevMonthStats.avgLead}일 -> ${monthlyAvgLeadTime}일
              `;
            } else {
              comparisonText = "전월 데이터가 없어 비교할 수 없습니다.";
            }

            const prompt = `
                당신은 데이터 분석가입니다. 아래 시디즈 AS 데이터를 분석하여 인사이트를 제공해주세요.
                
                기준: ${selectedYear}년 ${selectedMonth === 'ALL' ? '전체' : selectedMonth + '월'}
                
                [현재 실적]
                - 총 조치 건수: ${totalActionCount}건
                - 1차 종결율: ${firstVisitRate}%
                - 평균 리드타임: ${monthlyAvgLeadTime}일
                
                ${comparisonText}
                
                데이터 요약 (엔지니어 팀별 1차 종결 건수):
                ${JSON.stringify(engineerPerformanceData)}

                위 데이터를 바탕으로 전월 대비 실적 변화를 분석하고, 긍정적인 점과 개선이 필요한 점을 짧고 간결하게 3줄 요약해주세요.
                말투는 전문적이고 정중하게 해주세요.
            `;

            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt
            });
            
            if (response.text) {
              setAiAnalysis(response.text);
            } else {
              setAiAnalysis("AI 분석 결과를 가져올 수 없습니다.");
            }
        } catch (error) {
            console.error("AI Analysis failed", error);
            setAiAnalysis("AI 분석을 불러오는데 실패했습니다.");
        } finally {
            setAnalyzing(false);
        }
    };

    // Debounce analysis to avoid too many calls
    const timer = setTimeout(() => {
        if (data.length > 0) {
            generateAnalysis();
        }
    }, 1000);

    return () => clearTimeout(timer);
  }, [kpiData, selectedYear, selectedMonth, totalActionCount, firstVisitRate, monthlyAvgLeadTime, prevMonthStats]);


  // --- Render Helpers ---
  const COLORS = ['#171717', '#525252', '#a3a3a3', '#d4d4d4']; // Blue shades
  const DONUT_COLORS = ['#171717', '#eab308']; // Blue, Sky Blue

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-20">
      {loading && <LoadingOverlay />}
      
      {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 text-red-600 px-6 py-3 rounded-full shadow-lg border border-red-200 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={loadData} className="ml-2 underline hover:text-red-800">재시도</button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold">S</div>
             <h1 className="text-xl font-bold text-neutral-800">Sidiz AS Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://docs.google.com/spreadsheets/d/1u_On380lshvKgVVl5XTE57PGaD1VH_Fo_Nyp29uuN-c/edit?gid=91686959#gid=91686959" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">고객불편지수 시트</span>
            </a>
            <a 
              href="https://docs.google.com/spreadsheets/d/1u_On380lshvKgVVl5XTE57PGaD1VH_Fo_Nyp29uuN-c/edit?gid=141035174#gid=141035174" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">서울경인 AS데이터 시트</span>
            </a>
            <a 
              href="https://docs.google.com/spreadsheets/d/1YDoNUcSw8_6YSDX5kuXI0waFzF4fAucwzC64ng-bbjA/edit?gid=1632176056" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">AS출장비 데이터 시트</span>
            </a>
            <a 
              href="https://docs.google.com/spreadsheets/d/1u_On380lshvKgVVl5XTE57PGaD1VH_Fo_Nyp29uuN-c/edit?gid=2071842067#gid=2071842067" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">AS데이터 시트</span>
            </a>
            <button 
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-50 text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors text-sm font-medium"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 rounded-xl bg-neutral-100 p-1 mb-6">
          <button
            onClick={() => setActiveTab('inconvenience')}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all",
              activeTab === 'inconvenience'
                ? "bg-white text-neutral-800 shadow"
                : "text-neutral-600 hover:bg-white/[0.12] hover:text-neutral-800"
            )}
          >
            고객불편지수
          </button>
          <button
            onClick={() => setActiveTab('national')}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all",
              activeTab === 'national'
                ? "bg-white text-neutral-800 shadow"
                : "text-neutral-600 hover:bg-white/[0.12] hover:text-neutral-800"
            )}
          >
            전국 AS
          </button>
          <button
            onClick={() => setActiveTab('seoul')}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all",
              activeTab === 'seoul'
                ? "bg-white text-neutral-800 shadow"
                : "text-neutral-600 hover:bg-white/[0.12] hover:text-neutral-800"
            )}
          >
            서울경인 AS
          </button>
          <button
            onClick={() => setActiveTab('travelExpense')}
            className={cn(
              "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all",
              activeTab === 'travelExpense'
                ? "bg-white text-neutral-800 shadow"
                : "text-neutral-600 hover:bg-white/[0.12] hover:text-neutral-800"
            )}
          >
            AS출장비
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-3xl shadow-sm border border-neutral-100">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            {[2025, 2026].map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  selectedYear === year 
                    ? "bg-neutral-800 text-white shadow-md" 
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {year}년
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            <button
               onClick={() => setSelectedMonth('ALL')}
               className={cn(
                 "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                 selectedMonth === 'ALL'
                   ? "bg-neutral-800 text-white shadow-md" 
                   : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
               )}
            >
              ALL
            </button>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-medium transition-all min-w-[3rem] whitespace-nowrap",
                  selectedMonth === month
                    ? "bg-neutral-800 text-white shadow-md" 
                    : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {month}월
              </button>
            ))}
          </div>
        </div>

        {/* Chart: Customer Inconvenience Index */}
        {activeTab === 'inconvenience' && (
          <div className="space-y-6">
            <Card title="고객불편지수 추이" subTitle="월별 평균 고객불편지수 (검증됨)">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={inconvenienceTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="linear" dataKey="avgIndex" name="고객불편지수" stroke="#eab308" strokeWidth={3} dot={{ r: 5, fill: '#eab308', strokeWidth: 2, stroke: '#fff' }} label={{ position: 'top', fill: '#eab308', fontSize: 12, dy: -10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card 
              title="메모" 
              subTitle="공유 메모장"
              action={
                <button 
                  onClick={() => setIsEditingMemo(!isEditingMemo)}
                  className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  {isEditingMemo ? <Save size={18} /> : <Pen size={18} />}
                </button>
              }
            >
              <div className="min-h-[150px] w-full bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                {isEditingMemo ? (
                  <textarea
                    value={memoText}
                    onChange={(e) => setMemoText(e.target.value)}
                    className="w-full h-full min-h-[130px] bg-transparent resize-none outline-none text-neutral-800 placeholder:text-neutral-400"
                    placeholder="여기에 메모를 작성하세요..."
                    autoFocus
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-neutral-800">
                    {memoText || <span className="text-neutral-400 italic">작성된 메모가 없습니다. 우측 상단의 펜 아이콘을 눌러 메모를 작성해보세요.</span>}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* --- National AS Dashboard Section --- */}
        {activeTab === 'national' && (
          <>
            {/* KPI Board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="AS 총 조치 건" 
                value={`${formatNumber(totalActionCount)}건`} 
                subValue={`${selectedYear}년 ${selectedMonth === 'ALL' ? '전체' : selectedMonth + '월'} 기준`}
                icon={TrendingUp}
              />
              <StatCard 
                title="1차 종결 비중" 
                value={`${firstVisitRate}%`} 
                subValue="미방문 제외"
                icon={AlertCircle}
              />
              <StatCard 
                title="월 평균 리드타임" 
                value={`${monthlyAvgLeadTime}일`} 
                subValue="접수부터 조치까지"
                icon={Clock}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Monthly Receipt & Action Counts */}
              <Card title="월별 접수 및 조치 현황" subTitle="막대: 조치 건수 / 선: 접수 건수" className="col-span-1 lg:col-span-2">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyCountsData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar yAxisId="left" dataKey="actionCount" name="조치 건수" fill="#171717" radius={[4, 4, 0, 0]} barSize={40} label={{ position: 'top', fill: '#171717', fontSize: 12 }} />
                      <Line yAxisId="right" type="linear" dataKey="receiptCount" name="접수 건수" stroke="#eab308" strokeWidth={3} dot={{ r: 4, fill: '#eab308', strokeWidth: 2, stroke: '#fff' }} label={{ position: 'top', fill: '#eab308', fontSize: 12, dy: -10 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 2: 1st Visit Completion Rate Trend */}
              <Card title="1차 종결 비중 추이" subTitle="월별 1차/2차/3차+ 완결 비율" className="col-span-1 lg:col-span-2">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completionRateTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis tickFormatter={(tick) => `${Math.round(tick)}%`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => {
                            const countKey = `${name}_count`;
                            const count = props.payload[countKey];
                            return [`${formatNumber(count)}건 (${value}%)`, name];
                        }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar 
                        dataKey="1차완결" 
                        stackId="a" 
                        fill="#171717" 
                        radius={[0, 0, 0, 0]} 
                        barSize={48}
                        label={{ position: 'center', fill: 'white', fontSize: 12, formatter: (val: number) => val > 5 ? `${val}%` : '' }} 
                      />
                      <Bar dataKey="2차완결" stackId="a" fill="#a3a3a3" barSize={48} />
                      <Bar dataKey="3차이상" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 4: Average Lead Time Trend */}
              <Card title="평균 리드타임 추이" subTitle="월별 평균 처리 소요 일수" className="col-span-1 lg:col-span-2">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={avgLeadTimeTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="linear" dataKey="avgLeadTime" name="평균 리드타임 (일)" stroke="#171717" strokeWidth={3} dot={{ r: 5, fill: '#171717', strokeWidth: 2, stroke: '#fff' }} label={{ position: 'top', fill: '#171717', fontSize: 12, dy: -10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>
          </>
        )}

        {/* --- Seoul/Gyeongin AS Dashboard Section --- */}
        {activeTab === 'seoul' && (
          <div>
            {/* KPI Board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard 
                title="AS 총 조치 건" 
                value={`${formatNumber(seoulTotalActionCount)}건`} 
                subValue={`${selectedYear}년 ${selectedMonth === 'ALL' ? '전체' : selectedMonth + '월'} 기준`}
                icon={TrendingUp}
              />
              <StatCard 
                title="1차 종결 비중" 
                value={`${seoulFirstVisitRate}%`} 
                subValue="미방문 제외"
                icon={AlertCircle}
              />
              <StatCard 
                title="월 평균 리드타임" 
                value={`${seoulMonthlyAvgLeadTime}일`} 
                subValue="접수부터 조치까지"
                icon={Clock}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Monthly Receipt & Action Counts (Combo) */}
              <Card title="월별 접수 및 조치 현황" subTitle="막대: 조치 건수 / 선: 접수 건수" className="col-span-1 lg:col-span-2">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={seoulMonthlyCountsData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar 
                        yAxisId="left" 
                        dataKey="actionCount" 
                        name="조치 건수" 
                        fill="#171717" 
                        radius={[4, 4, 0, 0]} 
                        barSize={40} 
                        label={{ position: 'top', fill: '#171717', fontSize: 12 }} 
                      />
                      <Line 
                        yAxisId="right" 
                        type="linear" 
                        dataKey="receiptCount" 
                        name="접수 건수" 
                        stroke="#eab308" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#eab308', strokeWidth: 2, stroke: '#fff' }} 
                        label={{ position: 'top', fill: '#eab308', fontSize: 12, dy: -10 }} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 2: 1st Visit Completion Rate Trend (100% Stacked) */}
              <Card title="1차 종결 비중 추이" subTitle="월별 1차/2차/3차+ 완결 비율">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={seoulCompletionRateTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }} stackOffset="expand">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis tickFormatter={(tick) => `${Math.round(tick * 100)}%`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => {
                            const countKey = `${name}_count`;
                            const count = props.payload[countKey];
                            return [`${formatNumber(count)}건 (${(value * 100).toFixed(1)}%)`, name];
                        }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar 
                        dataKey="1차완결" 
                        stackId="a" 
                        fill="#171717" 
                        radius={[0, 0, 0, 0]} 
                        barSize={48}
                        // Since we are using stackOffset="expand", the value passed to formatter is 0-1.
                        // We need to display it as %.
                        label={{ position: 'center', fill: 'white', fontSize: 12, formatter: (val: number) => val > 0 ? `${(val * 100).toFixed(1)}%` : '' }} 
                      />
                      <Bar dataKey="2차완결" stackId="a" fill="#a3a3a3" barSize={48} />
                      <Bar dataKey="3차이상" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 3: Engineer Team Performance (Donut) */}
              <Card title="엔지니어팀 실적 비교" subTitle="1차 종결 건 기준 (시공/CS팀 vs 엔지니어팀)">
                <div className="h-80 w-full flex items-center justify-center">
                  {seoulEngineerPerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={seoulEngineerPerformanceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={110}
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          
                            return (
                              <text 
                                x={x} 
                                y={y} 
                                fill="white" 
                                textAnchor="middle" 
                                dominantBaseline="central"
                                className="text-sm font-bold"
                              >
                                {`${(percent * 100).toFixed(1)}%`}
                              </text>
                            );
                          }}
                        >
                          {seoulEngineerPerformanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip 
                           formatter={(value: number) => `${formatNumber(value)}건`}
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-neutral-700 font-bold text-3xl">
                           {formatNumber(seoulEngineerPerformanceData.reduce((acc, curr) => acc + curr.value, 0))}건
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-neutral-400 flex flex-col items-center">
                      <AlertCircle className="mb-2" />
                      <p>데이터가 없습니다.</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Chart 4: Average Lead Time Trend (Line) */}
              <Card title="평균 리드타임 추이" subTitle="월별 평균 처리 소요 일수" className="col-span-1 lg:col-span-2">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={seoulAvgLeadTimeTrendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line 
                        type="linear" 
                        dataKey="avgLeadTime" 
                        name="평균 리드타임 (일)" 
                        stroke="#171717" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#171717', strokeWidth: 2, stroke: '#fff' }} 
                        label={{ position: 'top', fill: '#171717', fontSize: 12, dy: -10 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* --- Travel Expense Dashboard Section --- */}
        {activeTab === 'travelExpense' && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Monthly Total Travel Expense Trend (Bar) */}
              <Card title="월별 총 출장비 추이" subTitle="월별 금액 변동" className="col-span-1 lg:col-span-2">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={travelExpenseMonthlyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${formatNumber(value)}`} />
                      <Tooltip 
                        formatter={(value: number) => [`${formatNumber(value)}원`, 'AS 총 출장비']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {travelExpenseAverages.totalTravelExpense > 0 && (
                        <ReferenceLine 
                          y={travelExpenseAverages.totalTravelExpense} 
                          stroke="#eab308" 
                          strokeDasharray="4 4" 
                          label={{ position: 'insideTopLeft', value: `연 평균: ${formatNumber(travelExpenseAverages.totalTravelExpense)}원`, fill: '#ca8a04', fontSize: 12, dy: -10 }} 
                        />
                      )}
                      <Bar 
                        dataKey="totalTravelExpense" 
                        name="AS 총 출장비" 
                        fill="#171717" 
                        radius={[4, 4, 0, 0]} 
                        barSize={40} 
                        label={{ position: 'top', fill: '#171717', fontSize: 12, formatter: (val: number) => val > 0 ? formatNumber(val) : '' }} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 2: Free Service Cases Analysis (Combo) */}
              <Card title="무상 서비스 건수 분석" subTitle="막대: 무상 건 / 선: 무상 n차 건">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={travelExpenseMonthlyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {travelExpenseAverages.freeCases > 0 && (
                        <ReferenceLine 
                          y={travelExpenseAverages.freeCases} 
                          yAxisId="left"
                          stroke="#eab308" 
                          strokeDasharray="4 4" 
                          label={{ position: 'insideTopLeft', value: `연 평균: ${formatNumber(travelExpenseAverages.freeCases)}건`, fill: '#ca8a04', fontSize: 12, dy: -10 }} 
                        />
                      )}
                      <Bar 
                        yAxisId="left" 
                        dataKey="freeCases" 
                        name="무상 건" 
                        fill="#171717" 
                        radius={[4, 4, 0, 0]} 
                        barSize={40} 
                        label={{ position: 'insideBottom', fill: '#ffffff', fontSize: 11, dy: -10, formatter: (val: number) => val > 0 ? formatNumber(val) : '' }} 
                      />
                      <Line 
                        yAxisId="right" 
                        type="linear" 
                        dataKey="freeNthCases" 
                        name="무상 n차 건" 
                        stroke="#eab308" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#eab308', strokeWidth: 2, stroke: '#fff' }} 
                        label={{ position: 'top', fill: '#ca8a04', fontSize: 11, dy: -20, formatter: (val: number) => val > 0 ? formatNumber(val) : '' }} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 3: Free Travel Expense & N-th Ratio Analysis (Combo) */}
              <Card title="무상 출장비 및 N차 비중 분석" subTitle="막대: 무상 출장비 / 선: N차 출장비 비중">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={travelExpenseMonthlyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${formatNumber(value)}`} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value}%`} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'N차 출장비 비중') return [`${value}%`, name];
                          return [`${formatNumber(value)}원`, name];
                        }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f1f5f9' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      {travelExpenseAverages.freeTravelExpense > 0 && (
                        <ReferenceLine 
                          y={travelExpenseAverages.freeTravelExpense} 
                          yAxisId="left"
                          stroke="#eab308" 
                          strokeDasharray="4 4" 
                          label={{ position: 'insideTopLeft', value: `연 평균: ${formatNumber(travelExpenseAverages.freeTravelExpense)}원`, fill: '#ca8a04', fontSize: 12, dy: -10 }} 
                        />
                      )}
                      <Bar 
                        yAxisId="left" 
                        dataKey="freeTravelExpense" 
                        name="무상 출장비" 
                        fill="#171717" 
                        radius={[4, 4, 0, 0]} 
                        barSize={40} 
                        label={{ position: 'insideBottom', fill: '#ffffff', fontSize: 11, dy: -10, formatter: (val: number) => val > 0 ? formatNumber(Math.floor(val / 1000)) : '' }} 
                      />
                      <Line 
                        yAxisId="right" 
                        type="linear" 
                        dataKey="nthTravelExpenseRatio" 
                        name="N차 출장비 비중" 
                        stroke="#eab308" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#eab308', strokeWidth: 2, stroke: '#fff' }} 
                        label={{ position: 'top', fill: '#ca8a04', fontSize: 11, dy: -20, formatter: (val: number) => val > 0 ? `${val}%` : '' }} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* AI Analysis Note */}
        {(activeTab === 'national' || activeTab === 'seoul') && (
          <Card title="AI 분석 인사이트" className="bg-gradient-to-r from-neutral-800 to-neutral-900 text-white border-none shadow-lg shadow-neutral-200">
            <div className="flex gap-4">
              <div className="p-3 bg-white/20 rounded-2xl h-fit backdrop-blur-sm">
                <TrendingUp className="text-white" size={24} />
              </div>
              <div className="flex-1">
                {analyzing ? (
                   <div className="flex items-center gap-2 text-neutral-100 animate-pulse">
                      <RefreshCw className="animate-spin" size={16} />
                      <span>분석 중입니다...</span>
                   </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <p className="whitespace-pre-line text-neutral-50 leading-relaxed text-lg">
                      {aiAnalysis || "데이터를 분석할 수 없습니다."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

      </main>
    </div>
  );
}
