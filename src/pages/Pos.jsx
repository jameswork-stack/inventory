import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, push } from "firebase/database";
import "../styles/pos.css";

const POS = () => {
  const [paintProducts, setPaintProducts] = useState([]);
  const [toolProducts, setToolProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [unitType, setUnitType] = useState("L");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0); // NEW

  // Fetch Paint
  useEffect(() => {
    const productRef = ref(db, "products");
    onValue(productRef, (snapshot) => {
      const data = snapshot.val();
      const loaded = data
        ? Object.keys(data).map((key) => ({ id: key, type: "paint", ...data[key] }))
        : [];
      setPaintProducts(loaded);
    });
  }, []);

  // Fetch Tools
  useEffect(() => {
    const toolsRef = ref(db, "tools");
    onValue(toolsRef, (snapshot) => {
      const data = snapshot.val();
      const loaded = data
        ? Object.keys(data).map((key) => ({ id: key, type: "tool", ...data[key] }))
        : [];
      setToolProducts(loaded);
    });
  }, []);

  // Convert DB liters to liters
  const convertToLiters = (value, unit) =>
    unit === "mL" ? parseFloat(value) / 1000 : parseFloat(value);

  // Convert user input to liters
  const convertInputToLiters = (value) =>
    unitType === "mL" ? parseFloat(value) / 1000 : parseFloat(value);

  // ADD TO CART
  const addToCart = () => {
    if (!selectedProduct || !purchaseAmount) return;

    let totalPrice = 0;
    let profit = 0;
    let newItem = null;

    // 🎨 PAINT PURCHASE
    if (selectedProduct.type === "paint") {
      const available = convertToLiters(
        selectedProduct.literValue,
        selectedProduct.literUnit
      );
      const amountInLiters = convertInputToLiters(purchaseAmount);

      if (amountInLiters <= 0 || amountInLiters > available) {
        alert("Invalid purchase amount!");
        return;
      }

      totalPrice = amountInLiters * parseFloat(selectedProduct.price);

      const profitPerLiter = parseFloat(selectedProduct.profitPerLiter) || 0;
      profit = amountInLiters * profitPerLiter;

      newItem = {
        id: selectedProduct.id,
        item: selectedProduct.item,
        purchaseAmount: amountInLiters,
        pricePerUnit: selectedProduct.price,
        displayAmount: purchaseAmount + " " + unitType,
        totalPrice,
        profit,
        type: "paint",
      };
    }

    // 🛠 TOOL PURCHASE
    else {
      const qty = parseFloat(purchaseAmount);

      if (qty <= 0 || qty > selectedProduct.quantity) {
        alert("Invalid quantity!");
        return;
      }

      totalPrice = qty * parseFloat(selectedProduct.price);
      const profitPerQty = parseFloat(selectedProduct.profitPerQty) || 0;
      profit = qty * profitPerQty;

      newItem = {
        id: selectedProduct.id,
        item: selectedProduct.item,
        purchaseAmount: qty,
        pricePerUnit: selectedProduct.price,
        displayAmount: qty,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        type: "tool",
      };
    }

    // ensure item has selection flag for removal
    setCart([...cart, { ...newItem, selected: false }]);
    setSelectedProduct(null);
    setPurchaseAmount("");
    setUnitType("L");
  };

  // Toggle selection of a cart item by index
  const toggleSelect = (index) => {
    setCart((prev) =>
      prev.map((it, i) => (i === index ? { ...it, selected: !it.selected } : it))
    );
  };

  // Remove all selected items from cart
  const removeSelected = () => {
    setCart((prev) => prev.filter((it) => !it.selected));
  };

  // FINALIZE PURCHASE
  const finalizePurchase = async () => {
    try {
      const totalBeforeDiscount = cart.reduce((sum, i) => sum + i.totalPrice, 0);
      const finalAmount = totalBeforeDiscount - discount;

      const saleRecord = {
        customerName,
        items: cart,
        totalAmount: finalAmount,
        totalProfit: cart.reduce((sum, i) => sum + i.profit, 0),
        discount,
        date: new Date().toLocaleString(),
      };

      await push(ref(db, "sales"), saleRecord);

      // Update stock
      cart.forEach(async (item) => {
        if (item.type === "paint") {
          const product = paintProducts.find((p) => p.id === item.id);

          const current = convertToLiters(product.literValue, product.literUnit);
          const remaining = current - item.purchaseAmount;

          const newUnit = remaining >= 1 ? "L" : "mL";
          const newValue = newUnit === "L" ? remaining : remaining * 1000;

          await update(ref(db, `products/${item.id}`), {
            literValue: newValue,
            literUnit: newUnit,
          });
        } else {
          const product = toolProducts.find((p) => p.id === item.id);
          await update(ref(db, `tools/${item.id}`), {
            quantity: product.quantity - item.purchaseAmount,
          });
        }
      });

      alert("Purchase completed!");
      setCart([]);
      setCustomerName("");
      setDiscount(0);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Grouping
  const groupedPaints = paintProducts.reduce((acc, p) => {
    const liters = convertToLiters(p.literValue, p.literUnit);
    if (isNaN(liters) || liters <= 0) return acc;
    if (!acc[p.brand]) acc[p.brand] = [];
    acc[p.brand].push(p);
    return acc;
  }, {});

  const groupedTools = toolProducts.reduce((acc, p) => {
    const qty = Number(p.quantity) || 0;
    if (qty <= 0) return acc;
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="pos-container">
      {/* Header */}
      <div className="pos-header">
        <h2>Point of Sale (POS)</h2>
        <p>Manage sales transactions and inventory checkout</p>
      </div>

      {/* Paint Products */}
      <h3 className="section-header">🎨 Paint Products</h3>
      {Object.keys(groupedPaints).length > 0 ? (
        Object.keys(groupedPaints).map((brand) => (
          <div key={brand}>
            <h4 className="category-title">{brand}</h4>
            <table className="products-list-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Available Liters</th>
                  <th>Price per Liter</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedPaints[brand].map((p) => (
                  <tr key={p.id}>
                    <td>{p.item}</td>
                    <td>
                      {convertToLiters(p.literValue, p.literUnit).toFixed(2)} L
                    </td>
                    <td>₱{p.price}</td>
                    <td>
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="btn-select"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <p>No paint products available.</p>
        </div>
      )}

      {/* Tool Products */}
      <h3 className="section-header">🛠 Tool Products</h3>
      {Object.keys(groupedTools).length > 0 ? (
        Object.keys(groupedTools).map((cat) => (
          <div key={cat}>
            <h4 className="category-title">{cat}</h4>
            <table className="products-list-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedTools[cat].map((p) => (
                  <tr key={p.id}>
                    <td>{p.item}</td>
                    <td>{p.quantity}</td>
                    <td>₱{p.price}</td>
                    <td>
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="btn-select"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <p>No tool products available.</p>
        </div>
      )}

      {/* Selected Product Section */}
      {selectedProduct && (
        <div className="selected-product-section">
          <h3>Selected Product</h3>

          <div className="product-info">
            <div className="info-item">
              <div className="info-label">Product</div>
              <div className="info-value">{selectedProduct.item}</div>
            </div>

            <div className="info-item">
              <div className="info-label">Available</div>
              <div className="info-value">
                {selectedProduct.type === "paint"
                  ? `${convertToLiters(
                      selectedProduct.literValue,
                      selectedProduct.literUnit
                    ).toFixed(2)} L`
                  : `${selectedProduct.quantity} pcs`}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">Price</div>
              <div className="info-value">₱{selectedProduct.price}</div>
            </div>
          </div>

          <div className="purchase-controls">
            {selectedProduct.type === "paint" && (
              <div className="control-group">
                <label>Unit Type</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                >
                  <option value="L">Liters (L)</option>
                  <option value="mL">Milliliters (mL)</option>
                </select>
              </div>
            )}

            <div className="control-group">
              <label>
                {selectedProduct.type === "paint"
                  ? `Amount (${unitType})`
                  : "Quantity"}
              </label>
              <input
                type="number"
                placeholder="0"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
              />
            </div>

            <button onClick={addToCart} className="btn-add-to-cart">
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* Cart Section */}
      {cart.length > 0 && (
        <div className="cart-section">
          <h3>🛒 Shopping Cart</h3>

          <div className="customer-input">
            <label>Customer Name</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <table className="cart-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((c, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!c.selected}
                      onChange={() => toggleSelect(i)}
                    />
                  </td>
                  <td>{c.item}</td>
                  <td>{c.displayAmount}</td>
                  <td>₱{c.pricePerUnit}</td>
                  <td>₱{c.totalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Discount Section */}
          <div className="discount-section">
            <div className="discount-input-group">
              <label>Apply Discount (₱)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="summary-section">
            <div className="summary-card">
              <h3>Subtotal</h3>
              <p className="amount">
                ₱{cart.reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2)}
              </p>
            </div>

            {discount > 0 && (
              <div className="summary-card discount">
                <h3>Discount</h3>
                <p className="amount">-₱{discount.toFixed(2)}</p>
              </div>
            )}

            <div className="summary-card">
              <h3>Final Amount</h3>
              <p className="amount">
                ₱
                {(cart.reduce((s, i) => s + i.totalPrice, 0) - discount).toFixed(
                  2
                )}
              </p>
            </div>

            <div className="summary-card profit">
              <h3>Total Profit</h3>
              <p className="amount">
                ₱{cart.reduce((sum, item) => sum + (item.profit || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Complete Purchase Button */}
          <div className="action-buttons-section">
            <button onClick={removeSelected} className="btn-remove-selected">
              Remove Selected
            </button>
            <button onClick={finalizePurchase} className="btn-complete">
              Complete Purchase
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
