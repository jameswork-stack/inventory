import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";
import { getUser } from "../auth";
import "../styles/receipt.css";

const Receipt = () => {
  const currentUser = getUser();
  const isStaff = currentUser && currentUser.username === "staff@inventory.com";
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const salesRef = ref(db, "sales");
    onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      const loadedSales = data
        ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date in descending order (newest first)
        : [];
      setSales(loadedSales);
    });
  }, []);

  // ✅ DELETE SALE
  const deleteSale = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    await remove(ref(db, "sales/" + id));
    alert("Sale record deleted.");
  };

  // ✅ GENERATE PDF
  const generatePDF = (sale) => {
    const printWindow = window.open("", "", "width=900,height=650");

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
        </head>
        <body style="font-family: Arial; padding: 20px;">
          <h2>Boy Paint Center Toledo</h2>
          <p><strong>Customer:</strong> ${sale.customerName}</p>
          <p><strong>Date:</strong> ${sale.date}</p>
          <hr />

          <h3>Items:</h3>
          ${sale.items
            .map(
              (item) => `
              <p>
                <strong>${item.item}</strong><br/>
                Quantity: ${
                  item.displayAmount 
                    ? item.displayAmount
                    : item.type === "paint"
                    ? item.purchaseAmount + " Liters"
                    : item.purchaseAmount + " pcs"
                }<br/>
                Subtotal: ₱${(item.totalPrice || 0).toFixed(2)}<br/>
                VAT (12%): ₱${(item.tax || 0).toFixed(2)}<br/>
                Total: ₱${(item.totalPriceWithTax || item.totalPrice || 0).toFixed(2)}<br/>
              </p>
              <hr/>
            `
            )
            .join("")}

          <h3>Total Summary</h3>
          <p><strong>Subtotal:</strong> ₱${(sale.subtotal || 0).toFixed(2)}</p>
          <p><strong>VAT (12%):</strong> ₱${(sale.totalTax || 0).toFixed(2)}</p>
          <p><strong>Discount:</strong> ₱${(sale.discount || 0).toFixed(2)}</p>
          <p><strong>Total Amount:</strong> ₱${(sale.totalAmount || 0).toFixed(2)}</p>

          <script>
            window.print();
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="receipt-container">
      {/* Header */}
      <div className="receipt-header">
        <h2>Sales Receipts</h2>
        <p>View and manage all sales transactions</p>
      </div>

      {sales.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧾</div>
          <p>No sales records found. Start making transactions to see receipts here.</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="receipt-stats">

            <div className="stat-card">
              <h4>Total Transactions</h4>
              <p className="value">{sales.length}</p>
            </div>
          </div>

          {/* Receipts Table */}
          <table className="receipt-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Items</th>
                <th>Quantity Bought</th>
                <th>VAT (12%)</th>
                <th>Total Amount</th>
                <th>Discount</th>
                <th>Total Profit</th>
                <th>Purchase Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.customerName || "Walk-in Customer"}</td>

                  {/* Items Column */}
                  <td className="items-column">
                    {sale.items?.map((item, index) => (
                      <div key={index} className="item-entry">
                        {item.item}
                      </div>
                    ))}
                  </td>

                  {/* Quantity Bought Column */}
                  <td className="amount-column">
                    {sale.items?.map((item, index) => {
                      // Use displayAmount if available (contains unit info), otherwise format based on type
                      if (item.displayAmount) {
                        return (
                          <div key={index} className="amount-entry">
                            {item.displayAmount}
                          </div>
                        );
                      }
                      // Fallback: format based on type
                      return (
                        <div key={index} className="amount-entry">
                          {item.type === "paint"
                            ? `${item.purchaseAmount.toFixed(2)} L`
                            : `${item.purchaseAmount} pcs`}
                        </div>
                      );
                    })}
                  </td>

                  {/* VAT Column */}
                  <td className="money-value">
                    {sale.items?.map((item, index) => (
                      <div key={index} className="amount-entry">
                        ₱{(item.tax || 0).toFixed(2)}
                      </div>
                    ))}
                  </td>

                  {/* Total Amount */}
                  <td className="money-value">
                    ₱{sale.totalAmount?.toFixed(2) || "0.00"}
                  </td>

                  {/* Discount */}
                  <td className="money-value discount-value">
                    ₱{(sale.discount || 0).toFixed(2)}
                  </td>

                  {/* Total Profit */}
                  <td className="money-value profit-value">
                    ₱{(sale.totalProfit || 0).toFixed(2)}
                  </td>

                  {/* Date */}
                  <td className="date-value">{sale.date}</td>

                  {/* Actions */}
                  <td>
                    <div className="actions-cell">
                      <button
                        onClick={() => generatePDF(sale)}
                        className="btn-pdf"
                      >
                        Generate PDF
                      </button>

                      {!isStaff && (
                        <button
                          onClick={() => deleteSale(sale.id)}
                          className="btn-delete"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default Receipt;
