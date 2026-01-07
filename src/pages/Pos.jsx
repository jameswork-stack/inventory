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
  const [search, setSearch] = useState("");

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

  // Auto-set unit type when product is selected
  useEffect(() => {
    if (selectedProduct && selectedProduct.type === "paint") {
      // Map product unit to unit type
      const unitMap = {
        "gallon": "gallon",
        "pail": "pail",
        "L": "L",
        "mL": "mL"
      };
      const mappedUnit = unitMap[selectedProduct.literUnit] || "L";
      setUnitType(mappedUnit);
    }
  }, [selectedProduct]);

  // Convert DB liters to liters (for gallon and pail, treat as whole units)
  const convertToLiters = (value, unit) => {
    if (unit === "gallon" || unit === "pail") return parseFloat(value);
    return unit === "mL" ? parseFloat(value) / 1000 : parseFloat(value);
  };

  // Convert user input to liters (for gallon and pail, treat as whole units)
  const convertInputToLiters = (value) => {
    if (unitType === "gallon" || unitType === "pail") return parseFloat(value);
    return unitType === "mL" ? parseFloat(value) / 1000 : parseFloat(value);
  };

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
      const purchaseQty = parseFloat(purchaseAmount);
      
      // For gallon and pail, use whole number comparison
      // For L and mL, convert to liters for comparison
      let amountInLiters;
      if (unitType === "gallon" || unitType === "pail") {
        amountInLiters = purchaseQty; // Whole units
      } else {
        amountInLiters = convertInputToLiters(purchaseAmount);
      }

      if (purchaseQty <= 0 || amountInLiters > available) {
        alert("Invalid purchase amount!");
        return;
      }

      // Calculate price based on price unit
      let pricePerUnit = parseFloat(selectedProduct.price);
      if (selectedProduct.priceUnit === "perGallonSet" && unitType === "gallon") {
        totalPrice = purchaseQty * pricePerUnit;
      } else if (selectedProduct.priceUnit === "perPailSet" && unitType === "pail") {
        totalPrice = purchaseQty * pricePerUnit;
      } else if (selectedProduct.priceUnit === "perL") {
        totalPrice = amountInLiters * pricePerUnit;
      } else if (selectedProduct.priceUnit === "permL") {
        const amountInML = unitType === "mL" ? purchaseQty : amountInLiters * 1000;
        totalPrice = amountInML * pricePerUnit;
      } else {
        // Fallback: use amountInLiters for calculation
        totalPrice = amountInLiters * pricePerUnit;
      }

      const profitPerLiter = parseFloat(selectedProduct.profitPerLiter) || 0;
      profit = amountInLiters * profitPerLiter;

      // Format display amount
      const getUnitLabel = (unit) => {
        if (unit === "gallon") return "Gallon (Set)";
        if (unit === "pail") return "Pail (Set)";
        if (unit === "mL") return "mL";
        return "L";
      };

      // Calculate 12% VAT
      const tax = totalPrice * 0.12;
      const totalPriceWithTax = totalPrice + tax;

      newItem = {
        id: selectedProduct.id,
        item: selectedProduct.item,
        purchaseAmount: amountInLiters,
        pricePerUnit: selectedProduct.price,
        displayAmount: `${purchaseAmount} ${getUnitLabel(unitType)}`,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        totalPriceWithTax: parseFloat(totalPriceWithTax.toFixed(2)),
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

      // Calculate 12% VAT
      const tax = totalPrice * 0.12;
      const totalPriceWithTax = totalPrice + tax;

      newItem = {
        id: selectedProduct.id,
        item: selectedProduct.item,
        purchaseAmount: qty,
        pricePerUnit: selectedProduct.price,
        displayAmount: qty,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        totalPriceWithTax: parseFloat(totalPriceWithTax.toFixed(2)),
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
      const totalWithTax = cart.reduce((sum, i) => sum + (i.totalPriceWithTax || i.totalPrice), 0);
      const finalAmount = totalWithTax - discount;

      const saleRecord = {
        customerName,
        items: cart,
        subtotal: cart.reduce((sum, i) => sum + i.totalPrice, 0),
        totalTax: cart.reduce((sum, i) => sum + (i.tax || 0), 0),
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

          // Calculate proportion of stock remaining
          const proportionRemaining = current > 0 ? remaining / current : 0;
          
          // Get current cost values
          const currentTotalCost = parseFloat(product.cost) || 0;
          const currentCostPerUnit = parseFloat(product.costPerUnit) || 0;
          const currentTotalLiters = parseFloat(product.totalLiters) || current;
          
          // Calculate new cost (proportional to remaining stock)
          const newTotalCost = currentTotalCost * proportionRemaining;
          const newTotalLiters = remaining;
          
          // Cost per unit remains the same (weighted average)
          const updatedCostPerUnit = currentCostPerUnit;
          
          // Recalculate profit based on remaining stock
          let pricePerUnit = parseFloat(product.price) || 0;
          if (product.priceUnit === "permL") {
            pricePerUnit = pricePerUnit * 1000; // Convert to per liter
          } else if (product.priceUnit === "perGallonSet" || product.priceUnit === "perPailSet") {
            // For sets, price is already per set
            pricePerUnit = pricePerUnit;
          }
          
          const profitPerUnit = pricePerUnit - updatedCostPerUnit;
          const newTotalProfit = profitPerUnit * newTotalLiters;

          // Preserve original unit type if it's gallon or pail
          if (product.literUnit === "gallon" || product.literUnit === "pail") {
            await update(ref(db, `products/${item.id}`), {
              literValue: remaining,
              literUnit: product.literUnit,
              cost: parseFloat(newTotalCost.toFixed(2)),
              costPerUnit: parseFloat(updatedCostPerUnit.toFixed(2)),
              totalLiters: newTotalLiters,
              profitPerLiter: parseFloat(profitPerUnit.toFixed(2)),
              totalProfit: parseFloat(newTotalProfit.toFixed(2)),
            });
          } else {
            // For L and mL, convert as before
            const newUnit = remaining >= 1 ? "L" : "mL";
            const newValue = newUnit === "L" ? remaining : remaining * 1000;

            await update(ref(db, `products/${item.id}`), {
              literValue: newValue,
              literUnit: newUnit,
              cost: parseFloat(newTotalCost.toFixed(2)),
              costPerUnit: parseFloat(updatedCostPerUnit.toFixed(2)),
              totalLiters: newTotalLiters,
              profitPerLiter: parseFloat(profitPerUnit.toFixed(2)),
              totalProfit: parseFloat(newTotalProfit.toFixed(2)),
            });
          }
        } else {
          const product = toolProducts.find((p) => p.id === item.id);
          const currentQuantity = parseFloat(product.quantity) || 0;
          const remaining = currentQuantity - item.purchaseAmount;

          // Calculate proportion of stock remaining
          const proportionRemaining = currentQuantity > 0 ? remaining / currentQuantity : 0;
          
          // Get current cost values
          const currentTotalCost = parseFloat(product.cost) || 0;
          const currentCostPerQty = parseFloat(product.costPerQty) || 0;
          
          // Calculate new cost (proportional to remaining stock)
          const newTotalCost = currentTotalCost * proportionRemaining;
          
          // Cost per qty remains the same (weighted average)
          const updatedCostPerQty = currentCostPerQty;
          
          // Recalculate profit based on remaining stock
          const price = parseFloat(product.price) || 0;
          const profitPerQty = price - updatedCostPerQty;
          const newTotalProfit = profitPerQty * remaining;

          await update(ref(db, `tools/${item.id}`), {
            quantity: remaining,
            cost: parseFloat(newTotalCost.toFixed(2)),
            costPerQty: parseFloat(updatedCostPerQty.toFixed(2)),
            profitPerQty: parseFloat(profitPerQty.toFixed(2)),
            totalProfit: parseFloat(newTotalProfit.toFixed(2)),
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
  const filteredPaintProducts = paintProducts.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.item && p.item.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  const filteredToolProducts = toolProducts.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.item && p.item.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  const groupedPaints = filteredPaintProducts.reduce((acc, p) => {
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

      {/* Search */}
      <div className="pos-search">
        <input
          type="text"
          placeholder="Search paint or tool products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Selected Product Section (moved to top) */}
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
                  ? (() => {
                      const getUnitLabel = (unit) => {
                        if (unit === "gallon") return "Gallon (Set)";
                        if (unit === "pail") return "Pail (Set)";
                        if (unit === "mL") return "mL";
                        return "L";
                      };
                      return `${selectedProduct.literValue} ${getUnitLabel(selectedProduct.literUnit)}`;
                    })()
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
                  {selectedProduct.literUnit === "gallon" && (
                    <option value="gallon">Gallon (Set)</option>
                  )}
                  {selectedProduct.literUnit === "pail" && (
                    <option value="pail">Pail (Set)</option>
                  )}
                  {(selectedProduct.literUnit === "L" || selectedProduct.literUnit === "mL") && (
                    <>
                      <option value="L">Liters (L)</option>
                      <option value="mL">Milliliters (mL)</option>
                    </>
                  )}
                </select>
              </div>
            )}

            <div className="control-group">
              <label>
                {selectedProduct.type === "paint"
                  ? (() => {
                      const getUnitLabel = (unit) => {
                        if (unit === "gallon") return "Gallon (Set)";
                        if (unit === "pail") return "Pail (Set)";
                        if (unit === "mL") return "mL";
                        return "L";
                      };
                      return `Quantity (${getUnitLabel(unitType)})`;
                    })()
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

      {/* Cart Section (moved to top) */}
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
                <th>Subtotal</th>
                <th>VAT (12%)</th>
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
                  <td>₱{(c.tax || 0).toFixed(2)}</td>
                  <td>₱{(c.totalPriceWithTax || c.totalPrice).toFixed(2)}</td>
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

            <div className="summary-card">
              <h3>VAT (12%)</h3>
              <p className="amount">
                ₱{cart.reduce((sum, i) => sum + (i.tax || 0), 0).toFixed(2)}
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
                {(cart.reduce((s, i) => s + (i.totalPriceWithTax || i.totalPrice), 0) - discount).toFixed(
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
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedPaints[brand].map((p) => {
                  // Format quantity with proper unit label
                  const getUnitLabel = (unit) => {
                    if (unit === "gallon") return "Gallon (Set)";
                    if (unit === "pail") return "Pail (Set)";
                    if (unit === "mL") return "mL";
                    return "L";
                  };
                  
                  const quantityDisplay = `${p.literValue} ${getUnitLabel(p.literUnit)}`;
                  
                  // Format price with proper unit label
                  const getPriceUnitLabel = (priceUnit) => {
                    if (priceUnit === "perGallonSet") return "per Gallon (Set)";
                    if (priceUnit === "perPailSet") return "per Pail (Set)";
                    if (priceUnit === "permL") return "per mL";
                    return "per L";
                  };
                  
                  const priceDisplay = `₱${p.price} ${getPriceUnitLabel(p.priceUnit || "perL")}`;
                  
                  return (
                    <tr key={p.id}>
                      <td>{p.item}</td>
                      <td>{quantityDisplay}</td>
                      <td>{priceDisplay}</td>
                      <td>
                        <button
                          onClick={() => setSelectedProduct(p)}
                          className="btn-select"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      

      
    </div>
  );
};

export default POS;
