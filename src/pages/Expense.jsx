import { useEffect, useState } from "react";
import "../styles/expense.css";
import { db } from "../firebase";
import { ref, onValue, push, set, remove, off } from "firebase/database";
import { getUser } from "../auth";

const keyFromUsername = (u) => {
  if (!u) return "anonymous";
  return u.replace(/\./g, ",").replace(/@/g, "_");
};

const Expense = () => {
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [expenses, setExpenses] = useState([]);

  const user = getUser();
  const userKey = user ? keyFromUsername(user.username) : "anonymous";

  useEffect(() => {
    const isAdmin = user && user.username === "admin@inventory.com";
    const expensesRef = ref(db, `expenses`);

    const handleSnapshot = (snap) => {
      const val = snap.val() || {};

      // Flatten all users' expenses into a single list. Each item will include ownerKey.
      const list = [];
      Object.entries(val).forEach(([ownerKey, ownerObj]) => {
        if (!ownerObj) return;
        Object.entries(ownerObj).forEach(([id, exp]) => {
          list.push({ id, ownerKey, ...exp });
        });
      });

      // If not admin, filter to only current user's expenses
      const visible = isAdmin ? list : list.filter((i) => i.ownerKey === userKey);

      visible.sort((a, b) => new Date(b.date) - new Date(a.date));
      setExpenses(visible);
    };

    onValue(expensesRef, handleSnapshot);

    return () => off(expensesRef, 'value', handleSnapshot);
  }, [userKey]);

  const addExpense = async (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const item = {
      amount: num,
      details: details.trim(),
      date: new Date().toISOString(),
      createdBy: user ? user.username : null,
    };

    try {
      const listRef = ref(db, `expenses/${userKey}`);
      const newRef = push(listRef);
      await set(newRef, item);
      setAmount("");
      setDetails("");
    } catch (err) {
      console.error("Failed to add expense:", err);
      alert("Could not save expense. Check console for details.");
    }
  };

  const removeExpense = async (id, ownerKey, createdBy) => {
    const current = getUser();
    const isAdmin = current && current.username === "admin@inventory.com";
    const canDelete = isAdmin || (current && current.username === createdBy);
    if (!canDelete) {
      alert("You don't have permission to delete this expense.");
      return;
    }

    try {
      await remove(ref(db, `expenses/${ownerKey}/${id}`));
    } catch (err) {
      console.error("Failed to remove expense:", err);
      alert("Could not delete expense. Check console for details.");
    }
  };

  return (
    <div className="expense-page">
      <h2>Expenses</h2>

      <form className="expense-form" onSubmit={addExpense}>
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="text"
          placeholder="Details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <button type="submit">Add Expense</button>
      </form>

      <div className="expense-list">
        {expenses.length === 0 && <p className="empty">No expenses yet</p>}
        {expenses.map((exp) => (
          <div className="expense-item" key={exp.id + "_" + exp.ownerKey}>
            <div className="expense-left">
              <div className="expense-amount">₱{parseFloat(exp.amount).toFixed(2)}</div>
              <div className="expense-details">{exp.details || "-"}</div>
              <div className="expense-owner">By: {exp.createdBy || exp.ownerKey}</div>
            </div>
            <div className="expense-right">
              <div className="expense-date">{new Date(exp.date).toLocaleString()}</div>
              <ExpenseDeleteButton exp={exp} onDelete={removeExpense} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExpenseDeleteButton = ({ exp, onDelete }) => {
  const current = getUser();
  const isAdmin = current && current.username === "admin@inventory.com";
  const canDelete = isAdmin || (current && current.username === exp.createdBy);

  if (!canDelete) return null;

  return (
    <button
      className="expense-delete"
      onClick={() => onDelete(exp.id, exp.ownerKey, exp.createdBy)}
    >
      Delete
    </button>
  );
};

export default Expense;
