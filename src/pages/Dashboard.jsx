import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, off } from "firebase/database";
import "../styles/dashboard.css";
import { getUser } from "../auth";

// 📌 Recharts for Line Chart
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const Dashboard = () => {
  const [paintCount, setPaintCount] = useState(0);
  const [toolCount, setToolCount] = useState(0);
  const [totalLiters, setTotalLiters] = useState(0);
  const [totalToolQty, setTotalToolQty] = useState(0);

  const [lowPaintStock, setLowPaintStock] = useState([]);
  const [lowToolStock, setLowToolStock] = useState([]);

  const [totalPaintCost, setTotalPaintCost] = useState(0);
  const [totalPaintProfit, setTotalPaintProfit] = useState(0);

  const [totalToolCost, setTotalToolCost] = useState(0);
  const [totalToolProfit, setTotalToolProfit] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalSalesAllTime, setTotalSalesAllTime] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);

  const [salesData, setSalesData] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [chartType, setChartType] = useState("sales"); // ⭐ NEW


  // ---------------------------
  // FETCH PAINT PRODUCTS
  // ---------------------------
  useEffect(() => {
    const paintRef = ref(db, "products");
    onValue(paintRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setPaintCount(0);
        setTotalLiters(0);
        setLowPaintStock([]);
        setTotalPaintCost(0);
        setTotalPaintProfit(0);
        return;
      }

      const paints = Object.values(data);
      setPaintCount(paints.length);

      let litersTotal = 0;
      let lowStockList = [];
      let paintCost = 0;
      let paintProfit = 0;

      paints.forEach((p) => {
        const cost = parseFloat(p.cost) || 0;
        const profit = parseFloat(p.totalProfit) || 0;

        const liters =
          p.literUnit === "mL"
            ? parseFloat(p.literValue) / 1000
            : parseFloat(p.literValue);

        if (!isNaN(liters)) {
          litersTotal += liters;

          if (liters < (p.lowStockThreshold || 17)) {  // Use the product's low stock threshold or default to 17L
            lowStockList.push({
              item: p.item,
              liters: liters.toFixed(2),
              threshold: p.lowStockThreshold || 17  // Store the threshold for display
            });
          }
        }

        paintCost += cost;
        paintProfit += profit;
      });

      setTotalLiters(litersTotal);
      setLowPaintStock(lowStockList);
      setTotalPaintCost(paintCost);
      setTotalPaintProfit(paintProfit);
    });
  }, []);

  // ---------------------------
  // FETCH TOOL PRODUCTS
  // ---------------------------
  useEffect(() => {
    const toolRef = ref(db, "tools");
    onValue(toolRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setToolCount(0);
        setTotalToolQty(0);
        setLowToolStock([]);
        setTotalToolCost(0);
        setTotalToolProfit(0);
        return;
      }

      const tools = Object.values(data);
      setToolCount(tools.length);

      let qty = 0;
      let lowTools = [];
      let toolCost = 0;
      let toolProfit = 0;

      tools.forEach((t) => {
        const quantity = parseFloat(t.quantity) || 0;
        const cost = parseFloat(t.cost) || 0;
        const profit = parseFloat(t.totalProfit) || 0;

        qty += quantity;
        toolCost += cost;
        toolProfit += profit;

        const threshold = t.lowStockThreshold || 5;  // Use the product's threshold or default to 5
        if (quantity < threshold) {  // Changed from <= to < to trigger only when strictly below threshold
          lowTools.push({
            item: t.item,
            quantity,
            threshold  // Include the threshold in the alert
          });
        }
      });

      setTotalToolQty(qty);
      setLowToolStock(lowTools);
      setTotalToolCost(toolCost);
      setTotalToolProfit(toolProfit);
    });
  }, []);

  // ---------------------------
  // SALES & PROFIT CHART DATA
  // ---------------------------
  useEffect(() => {
    const salesRef = ref(db, "sales");
    onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setSalesData([]);
        setTotalDiscount(0);
        return;
      }

      const sales = Object.values(data);
      let filteredSales = sales;

      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);

        filteredSales = sales.filter((sale) => {
          const saleDate = new Date(sale.date);
          return saleDate >= s && saleDate <= e;
        });
      }

      const grouped = {};

      filteredSales.forEach((s) => {
        const date = new Date(s.date).toLocaleDateString();

        if (!grouped[date]) {
          grouped[date] = { totalAmount: 0, totalProfit: 0 };
        }

        grouped[date].totalAmount += Number(s.totalAmount);
        grouped[date].totalProfit += Number(s.totalProfit);
      });

      const formatted = Object.entries(grouped).map(
        ([date, values]) => ({
          date,
          totalAmount: values.totalAmount,
          totalProfit: values.totalProfit,
        })
      );
      // compute total discount for the currently selected range
      const totalDisc = filteredSales.reduce(
        (s, sale) => s + (parseFloat(sale.discount) || 0),
        0
      );
      setTotalDiscount(totalDisc);

      setSalesData(formatted);
    });
  }, [startDate, endDate]);

  // ---------------------------
  // TOTAL EXPENSES (per user)
  // ---------------------------
  useEffect(() => {
    const user = getUser();
    const keyFromUsername = (u) => {
      if (!u) return "anonymous";
      return u.replace(/\./g, ",").replace(/@/g, "_");
    };

    const userKey = user ? keyFromUsername(user.username) : "anonymous";
    const isAdmin = user && user.username === "admin@inventory.com";

    const expensesRef = isAdmin ? ref(db, `expenses`) : ref(db, `expenses/${userKey}`);

    const handleSnapshot = (snap) => {
      const val = snap.val() || {};

      // Build a flat list of expense objects. Admin sees all users' expenses.
      let list = [];
      if (isAdmin) {
        // val is { userKey: { expenseId: expenseObj, ... }, ... }
        Object.values(val).forEach((userObj) => {
          if (userObj) {
            Object.values(userObj).forEach((exp) => list.push(exp));
          }
        });
      } else {
        // val is { expenseId: expenseObj, ... }
        list = Object.values(val);
      }

      let filtered = list;
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        filtered = list.filter((it) => {
          const d = new Date(it.date);
          return d >= s && d <= e;
        });
      }

      const sum = filtered.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
      setTotalExpenses(sum);
    };

    onValue(expensesRef, handleSnapshot);

    return () => {
      off(expensesRef, 'value', handleSnapshot);
    };
  }, [startDate, endDate]);

  // ---------------------------
  // TOTAL SALES (All Time) for net income calculation
  // ---------------------------
  useEffect(() => {
    const salesRefAll = ref(db, "sales");
    const handleSalesAll = (snap) => {
      const val = snap.val() || {};
      const list = Object.values(val);
      const sum = list.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
      setTotalSalesAllTime(sum);
    };

    onValue(salesRefAll, handleSalesAll);
    return () => {
      off(salesRefAll, 'value', handleSalesAll);
    };
  }, []);


  const totalSales = salesData.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalProfit = salesData.reduce((sum, d) => sum + d.totalProfit, 0);


  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h2>Dashboard Overview</h2>
        <p>Monitor your inventory and sales performance</p>
      </div>

      {/* Date Filter Section */}
      <div className="filter-section">
        <h3>Filter Sales by Date Range</h3>
        <div className="filter-controls">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Total Sales Card */}
      <div className="total-sales-card">
        <h3>
          {chartType === "sales"
            ? "Total Sales in Selected Range"
            : "Total Profit in Selected Range"}
        </h3>

        <p className="amount">
          ₱
          {chartType === "sales"
            ? totalSales.toFixed(2)
            : totalProfit.toFixed(2)}
        </p>
      </div>

      {/* Total Expenses Card */}
      <div className="total-sales-card">
        <h3>
          {startDate && endDate
            ? "Total Expenses in Selected Range"
            : "Total Expenses (All Time)"}
        </h3>
        <p className="amount">₱{totalExpenses.toFixed(2)}</p>
      </div>

      {/* Total Discount Card */}
      <div className="total-sales-card">
        <h3>
          {startDate && endDate
            ? "Total Discount in Selected Range"
            : "Total Discount (All Time)"}
        </h3>
        <p className="amount">₱{totalDiscount.toFixed(2)}</p>
      </div>

      {/* Total Net Income Card (uses selected range sales vs expenses) */}
      <div className="total-sales-card">
        <h3>
          {startDate && endDate
            ? "Net Income in Selected Range"
            : "Total Net Income (All Time)"}
        </h3>
        <p className="amount">₱{(totalSales - totalExpenses).toFixed(2)}</p>
      </div>

      {/* ⭐ Chart Type Switch */}
      <div style={{ marginBottom: "10px", textAlign: "right" }}>
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value)}
          style={{ padding: "8px", borderRadius: "6px" }}
        >
          <option value="sales">Daily Sales</option>
          <option value="profit">Daily Profit</option>
        </select>
      </div>

      {/* Sales / Profit Chart */}
      <div className="chart-section">
        <h3>
          {chartType === "sales" ? "Daily Sales Chart" : "Daily Profit Chart"}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" stroke="#718096" />
            <YAxis stroke="#718096" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            />

            <Line
              type="monotone"
              dataKey={chartType === "sales" ? "totalAmount" : "totalProfit"}
              stroke="#667eea"
              strokeWidth={3}
              dot={{ fill: "#667eea", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {/* Paint Summary */}
        <div className="stat-card">
          <h3>🎨 Paint Products</h3>
          <p>
            <strong>Total Types:</strong>{" "}
            <span className="stat-value">{paintCount}</span>
          </p>
          <p>
            <strong>Total Stock:</strong>{" "}
            <span className="stat-value">{totalLiters.toFixed(2)} L</span>
          </p>
          {lowPaintStock.length > 0 && (
            <div className="low-stock-section">
              <h4>⚠ Low Stock Alert</h4>
              {lowPaintStock.map((p, i) => (
                <div key={i} className="low-stock-item">
                  {p.item} — {p.liters}L remaining (low stock, threshold: {p.threshold}L)
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tool Summary */}
        <div className="stat-card">
          <h3>🛠 Tool Products</h3>
          <p>
            <strong>Total Items:</strong>{" "}
            <span className="stat-value">{toolCount}</span>
          </p>
          <p>
            <strong>Total Quantity:</strong>{" "}
            <span className="stat-value">{totalToolQty}</span>
          </p>
          {lowToolStock.length > 0 && (
            <div className="low-stock-section">
              <h4>⚠ Low Stock Alert</h4>
              {lowToolStock.map((t, i) => (
                <div key={i} className="low-stock-item">
                  {t.item} — {t.quantity} qty (low stock, threshold: {t.threshold} qty)
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cost & Profit Summary */}
      <div className="cost-profit-grid">
        <div className="cost-profit-card">
          <h3>🎨 Paint Cost & Profit</h3>
          <div className="cost-profit-item">
            <label>Total Cost</label>
            <span className="value">₱{totalPaintCost.toFixed(2)}</span>
          </div>
          <div className="cost-profit-item profit">
            <label>Total Profit</label>
            <span className="value">₱{totalPaintProfit.toFixed(2)}</span>
          </div>
        </div>

        <div className="cost-profit-card">
          <h3>🛠 Tool Cost & Profit</h3>
          <div className="cost-profit-item">
            <label>Total Cost</label>
            <span className="value">₱{totalToolCost.toFixed(2)}</span>
          </div>
          <div className="cost-profit-item profit">
            <label>Total Profit</label>
            <span className="value">₱{totalToolProfit.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
