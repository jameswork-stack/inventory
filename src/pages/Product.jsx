import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, remove, push } from "firebase/database";
import { getUser } from "../auth";
import "../styles/product.css";

// Add some styles for the stock status
const styles = `
  .low-stock {
    background-color: #fff3cd;
    color: #856404;
    font-weight: 500;
  }
  .in-stock {
    background-color: #d4edda;
    color: #155724;
  }
  .sold {
    background-color: #f8d7da;
    color: #721c24;
  }
  .low-stock-badge {
    display: inline-block;
    background-color: #ffc107;
    color: #000;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: bold;
    margin-top: 4px;
  }
`;

// Add the styles to the document head
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);


const Product = () => {
  const [product, setProduct] = useState({
    brand: "",
    item: "",
    literValue: "",
    literUnit: "L",
    price: "",
    priceUnit: "perL",
    cost: "",
    costPerUnit: "",
    lowStockThreshold: "", // New field for low stock threshold
  });

  const [products, setProducts] = useState([]); // For listing products
  const [search, setSearch] = useState(""); // Search bar

  // Editing state (per-row)
  const [editingId, setEditingId] = useState(null);
  const currentUser = getUser();
  const isStaff = currentUser && currentUser.username === "staff@inventory.com";
  const [editData, setEditData] = useState({});

  // Stock management state
  const [stockForm, setStockForm] = useState({
    productId: "",
    transactionType: "in", // "in" or "out"
    quantity: "",
    unit: "L",
    costPerUnit: "",
  });
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Fetch products from Firebase
  useEffect(() => {
    const productRef = ref(db, "products");
    onValue(productRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedProducts = Object.keys(data).map((id) => ({ id, ...data[id] }));
      setProducts(loadedProducts);
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProductDropdown && !event.target.closest('.product-search-container')) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown]);

  // Handle form input (Add)
  const handleChange = (e) => {
    const { name, value } = e.target;

    setProduct((prev) => {
      const updated = { ...prev, [name]: value };

      // parse numeric values for calculations
      const quantity = parseFloat(updated.literValue) || 0;
      let totalLiters = quantity; // Default for liters
      
      // Handle different unit types
      if (updated.literUnit === 'mL') {
        totalLiters = quantity / 1000; // Convert mL to L
      }
      const totalCost = parseFloat(updated.cost) || 0;
      const perL = parseFloat(updated.costPerUnit) || 0;

      // If user edited total cost, compute cost per unit
      if (name === "cost") {
        updated.costPerUnit = totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : "";
      }

      // If user edited cost per unit, compute total cost
      if (name === "costPerUnit") {
        updated.cost = !isNaN(perL) ? Number((perL * totalLiters).toFixed(2)) : "";
      }

      // If quantity changed, recalc whichever cost field is present
      if (name === "literValue" || name === "literUnit") {
        if (!isNaN(perL) && perL > 0) {
          updated.cost = Number((perL * totalLiters).toFixed(2));
        } else if (!isNaN(totalCost) && totalCost > 0) {
          updated.costPerUnit = totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : "";
        }
      }

      return updated;
    });
  };

  // Save new product (unchanged behavior)
  const saveProduct = async (e) => {
    e.preventDefault();

    try {
      const literValueRaw = parseFloat(product.literValue) || 0;
      const priceInput = parseFloat(product.price) || 0;
      const totalCost = parseFloat(product.cost) || 0;
      const costPerUnitInput = parseFloat(product.costPerUnit) || 0;
      const lowStockThreshold = parseFloat(product.lowStockThreshold) || 0;

      // Convert amount to liters
      const totalLiters = product.literUnit === "mL" ? literValueRaw / 1000 : literValueRaw;

      // Convert input price to per liter based on unit
      let pricePerLiter = priceInput;
      if (product.priceUnit === "permL") {
        pricePerLiter = priceInput * 1000; // Convert per mL to per L
      } else if (product.priceUnit === "perGallonSet") {
        // No conversion needed for sets, just use as is
        pricePerLiter = priceInput;
      } else if (product.priceUnit === "perPailSet") {
        // No conversion needed for sets, just use as is
        pricePerLiter = priceInput;
      }

      // Use provided costPerUnit if given, otherwise compute from total cost
      const costPerUnit = costPerUnitInput > 0 ? costPerUnitInput : (totalLiters > 0 ? totalCost / totalLiters : 0);

      // Profit per liter & total
      const profitPerLiter = pricePerLiter - costPerUnit;
      const totalProfit = profitPerLiter * totalLiters;

      const newProduct = {
        ...product,
        literValue: literValueRaw,
        totalLiters,
        pricePerLiter,
        costPerUnit,
        profitPerLiter,
        totalProfit,
        lowStockThreshold,
      };

      const productRef = ref(db, "products");
      await push(productRef, newProduct);

      alert("Product saved successfully!");

      // Reset form
      // Keep total cost and cost per liter so user can add similar items quickly
      setProduct({
        brand: "",
        item: "",
        literValue: "",
        literUnit: "L",
        price: "",
        priceUnit: "perL",
        cost: product.cost,
        costPerUnit: product.costPerUnit,
        lowStockThreshold: product.lowStockThreshold,
      });
    } catch (error) {
      console.error("Error adding product: ", error);
    }
  };

  // Start editing a row
  const startEdit = (p) => {
    setEditingId(p.id);

    // Initialize editData with only editable fields
    setEditData({
      item: p.item || "",
      lowStockThreshold: p.lowStockThreshold ?? 0,
    });
  };

  // Handle inline edit inputs
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  // Save edited row to Firebase (only item and low stock threshold)
  const saveEdit = async (id) => {
    try {
      // Only update item and low stock threshold
      const updates = {
        item: editData.item,
        lowStockThreshold: editData.lowStockThreshold === "" ? 0 : Number(editData.lowStockThreshold),
      };

      await update(ref(db, `products/${id}`), updates);

      // clear editing state
      setEditingId(null);
      setEditData({});
    } catch (err) {
      console.error("Error saving edit: ", err);
    }
  };

  // Filter & group by brand
  const filteredProducts = products
    .filter(
      (p) =>
        p.brand?.toLowerCase().includes(search.toLowerCase()) ||
        p.item?.toLowerCase().includes(search.toLowerCase())
    )
    .reduce((acc, curr) => {
      const brand = curr.brand || "Unbranded";
      if (!acc[brand]) acc[brand] = [];
      acc[brand].push(curr);
      return acc;
    }, {});

  // Sort inside each brand: available first -> SOLD last
  Object.keys(filteredProducts).forEach((brand) => {
    filteredProducts[brand].sort((a, b) => {
      const quantityA = a.literUnit === "mL" ? parseFloat(a.literValue) / 1000 : parseFloat(a.literValue);
      const quantityB = b.literUnit === "mL" ? parseFloat(b.literValue) / 1000 : parseFloat(b.literValue);
      const isSoldA = quantityA <= 0;
      const isSoldB = quantityB <= 0;
      if (isSoldA === isSoldB) return 0;
      return isSoldA ? 1 : -1;
    });
  });

  const deleteProduct = async (id) => {
  const ok = window.confirm("Are you sure you want to delete this product?");
  if (!ok) return;

  try {
    await remove(ref(db, `products/${id}`));
  } catch (err) {
    console.error("Error deleting product:", err);
  }
};

  // Handle stock form input
  const handleStockChange = (e) => {
    const { name, value } = e.target;
    setStockForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle product search input
  const handleProductSearch = (e) => {
    const value = e.target.value;
    setProductSearch(value);
    setShowProductDropdown(true);
    
    // If input is cleared, clear selected product
    if (!value) {
      setStockForm((prev) => ({ ...prev, productId: "" }));
    }
  };

  // Handle product selection from dropdown
  const selectProduct = (product) => {
    setStockForm((prev) => ({
      ...prev,
      productId: product.id,
      unit: product.literUnit || "L",
    }));
    setProductSearch(`${product.brand} - ${product.item} (${product.literValue} ${product.literUnit})`);
    setShowProductDropdown(false);
  };

  // Filter products based on search
  const filteredProductsForStock = products.filter((p) => {
    if (!productSearch) return false;
    const searchLower = productSearch.toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    const item = (p.item || "").toLowerCase();
    return brand.includes(searchLower) || item.includes(searchLower);
  });

  // Handle stock in/out transaction
  const handleStockTransaction = async (e) => {
    e.preventDefault();
    
    if (!stockForm.productId || !stockForm.quantity) {
      alert("Please fill in all required fields");
      return;
    }

    // For stock in, cost per unit is required
    if (stockForm.transactionType === "in" && !stockForm.costPerUnit) {
      alert("Please enter cost per unit for stock in");
      return;
    }

    try {
      const product = products.find((p) => p.id === stockForm.productId);
      if (!product) {
        alert("Product not found");
        return;
      }

      const transactionQuantity = parseFloat(stockForm.quantity) || 0;
      const newCostPerUnit = parseFloat(stockForm.costPerUnit) || 0;
      const newUnit = stockForm.unit;
      const productUnit = product.literUnit || "L";
      const currentQuantityValue = parseFloat(product.literValue) || 0;
      const currentTotalCost = parseFloat(product.cost) || 0;
      const currentCostPerUnit = parseFloat(product.costPerUnit) || 0;

      // Handle different unit types - convert everything to a common base for calculation
      let currentQuantityInBase, transactionQuantityInBase, updatedQuantityValue, updatedUnit;

      // For gallon and pail products, treat as whole units (no conversion)
      if (productUnit === "gallon" || productUnit === "pail") {
        // Ensure new unit matches product unit
        if (newUnit !== productUnit) {
          alert(`Unit mismatch! Product is in ${productUnit}, please use the same unit.`);
          return;
        }
        
        currentQuantityInBase = currentQuantityValue;
        transactionQuantityInBase = transactionQuantity;
        
        if (stockForm.transactionType === "in") {
          updatedQuantityValue = currentQuantityInBase + transactionQuantityInBase;
        } else {
          if (transactionQuantityInBase > currentQuantityInBase) {
            alert("Cannot remove more stock than available!");
            return;
          }
          updatedQuantityValue = currentQuantityInBase - transactionQuantityInBase;
        }
        updatedUnit = productUnit;
      } 
      // For L and mL products, convert to liters for calculation
      else {
        // Convert current quantity to liters
        currentQuantityInBase = productUnit === "mL" 
          ? currentQuantityValue / 1000 
          : currentQuantityValue;

        // Convert transaction quantity to liters
        if (newUnit === "mL") {
          transactionQuantityInBase = transactionQuantity / 1000;
        } else if (newUnit === "L") {
          transactionQuantityInBase = transactionQuantity;
        } else {
          alert("Unit mismatch! Product is in L/mL, please use L or mL.");
          return;
        }

        // Calculate updated quantity
        let totalQuantityInLiters;
        if (stockForm.transactionType === "in") {
          totalQuantityInLiters = currentQuantityInBase + transactionQuantityInBase;
        } else {
          if (transactionQuantityInBase > currentQuantityInBase) {
            alert("Cannot remove more stock than available!");
            return;
          }
          totalQuantityInLiters = currentQuantityInBase - transactionQuantityInBase;
        }
        
        // Convert back to appropriate unit for storage
        if (totalQuantityInLiters >= 1) {
          updatedUnit = "L";
          updatedQuantityValue = totalQuantityInLiters;
        } else {
          updatedUnit = "mL";
          updatedQuantityValue = totalQuantityInLiters * 1000;
        }
      }

      let totalNewCost, weightedCostPerUnit, totalQuantityInBase;

      if (stockForm.transactionType === "in") {
        // STOCK IN: Add stock and calculate weighted average cost
        const newStockCost = newCostPerUnit * transactionQuantityInBase;
        totalNewCost = currentTotalCost + newStockCost;
        totalQuantityInBase = currentQuantityInBase + transactionQuantityInBase;
        weightedCostPerUnit = totalQuantityInBase > 0 
          ? totalNewCost / totalQuantityInBase 
          : newCostPerUnit;
      } else {
        // STOCK OUT: Remove stock and reduce cost proportionally
        if (currentQuantityInBase <= 0) {
          alert("No stock available to remove!");
          return;
        }
        
        const proportionRemaining = currentQuantityInBase > 0 
          ? (currentQuantityInBase - transactionQuantityInBase) / currentQuantityInBase 
          : 0;
        
        totalNewCost = currentTotalCost * proportionRemaining;
        totalQuantityInBase = currentQuantityInBase - transactionQuantityInBase;
        weightedCostPerUnit = currentCostPerUnit; // Cost per unit remains the same
      }

      // Recalculate profit based on product's price unit
      let pricePerUnit = parseFloat(product.price) || 0;
      let profitPerUnit, totalProfit;

      if (totalQuantityInBase > 0) {
        if (product.priceUnit === "perGallonSet" || product.priceUnit === "perPailSet") {
          profitPerUnit = pricePerUnit - weightedCostPerUnit;
          totalProfit = profitPerUnit * totalQuantityInBase;
        } else if (product.priceUnit === "perL") {
          profitPerUnit = pricePerUnit - weightedCostPerUnit;
          totalProfit = profitPerUnit * totalQuantityInBase;
        } else if (product.priceUnit === "permL") {
          const pricePerLiter = pricePerUnit * 1000;
          profitPerUnit = pricePerLiter - weightedCostPerUnit;
          totalProfit = profitPerUnit * totalQuantityInBase;
        } else {
          profitPerUnit = pricePerUnit - weightedCostPerUnit;
          totalProfit = profitPerUnit * totalQuantityInBase;
        }
      } else {
        // If quantity is zero, set profit to zero
        profitPerUnit = 0;
        totalProfit = 0;
      }

      // Update product in Firebase
      await update(ref(db, `products/${stockForm.productId}`), {
        literValue: updatedQuantityValue,
        literUnit: updatedUnit,
        cost: parseFloat(totalNewCost.toFixed(2)),
        costPerUnit: parseFloat(weightedCostPerUnit.toFixed(2)),
        totalLiters: totalQuantityInBase,
        profitPerLiter: parseFloat(profitPerUnit.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
      });

      alert(`Stock ${stockForm.transactionType === "in" ? "added" : "removed"} successfully!`);
      
      // Reset stock form
      setStockForm({
        productId: "",
        transactionType: "in",
        quantity: "",
        unit: "L",
        costPerUnit: "",
      });
      setProductSearch("");
      setShowProductDropdown(false);
    } catch (error) {
      console.error("Error processing stock transaction: ", error);
      alert("Error processing stock transaction. Please try again.");
    }
  };


  return (
    <div className="product-container">
      {/* Header */}
      <div className="product-header">
        <h2>Product Management</h2>
        <p>Add and manage paint products in your inventory</p>
      </div>

      {/* Form Section */}
      <div className="product-form-section">
        <h3>Add New Product</h3>

        <form onSubmit={saveProduct} className="product-form">
          <div className="form-row">
            <div className="form-group">
              <label>Brand Name</label>
              <input
                type="text"
                name="brand"
                placeholder="e.g., Boysen, Nippon Paint"
                value={product.brand}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Item</label>
              <input
                type="text"
                name="item"
                placeholder="e.g., Gloss Premium White"
                value={product.item}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>Quantity</label>
              <input
                type="number"
                name="literValue"
                placeholder="0"
                value={product.literValue}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select name="literUnit" value={product.literUnit} onChange={handleChange}>
                <option value="gallon">Gallon (Set)</option>
                <option value="pail">Pail (Set)</option>
                <option value="L">Liter</option>
                <option value="mL">Milliliter</option>
              </select>
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>Price</label>
              <input
                type="number"
                name="price"
                placeholder="0"
                value={product.price}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Price Unit</label>
              <select name="priceUnit" value={product.priceUnit} onChange={handleChange}>
                <option value="perGallonSet">₱ per Gallon (Set)</option>
                <option value="perPailSet">₱ per Pail (Set)</option>
                <option value="perL">₱ per Liter</option>
                <option value="permL">₱ per Milliliter</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-row-inline">
              <div className="form-group" style={{ flex: 1.5 }}>
                <label>Cost per Unit</label>
                <input
                  type="number"
                  name="costPerUnit"
                  placeholder="0"
                  value={product.costPerUnit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Total Cost</label>
                <input
                  type="number"
                  name="cost"
                  placeholder="0"
                  value={product.cost}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Low Stock Alert (Sets)</label>
              <input
                type="number"
                name="lowStockThreshold"
                placeholder="Set low stock threshold"
                value={product.lowStockThreshold}
                onChange={handleChange}
                min="0"
                step="0.1"
              />
              <small className="hint">Leave empty to disable low stock alerts</small>
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Save Product
          </button>
        </form>
      </div>

      {/* Search Section */}
      

      {/* Stock Management Section */}
      <div className="product-form-section">
        <h3>Stock In / Out Management</h3>
        <form onSubmit={handleStockTransaction} className="product-form">
          <div className="form-row">
            <div className="form-group">
              <label>Transaction Type</label>
              <select
                name="transactionType"
                value={stockForm.transactionType}
                onChange={handleStockChange}
                required
              >
                <option value="in">Stock In (Add)</option>
                <option value="out">Stock Out (Remove)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group product-search-container" style={{ position: "relative" }}>
              <label>Select Product</label>
              <input
                type="text"
                placeholder="Search product by brand or item name..."
                value={productSearch}
                onChange={handleProductSearch}
                onFocus={() => setShowProductDropdown(true)}
                required
                style={{ width: "100%" }}
              />
              {showProductDropdown && filteredProductsForStock.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    marginTop: "4px",
                  }}
                >
                  {filteredProductsForStock.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      style={{
                        padding: "10px",
                        cursor: "pointer",
                        borderBottom: "1px solid #eee",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#f0f0f0";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "white";
                      }}
                    >
                      <strong>{p.brand}</strong> - {p.item} ({p.literValue} {p.literUnit})
                    </div>
                  ))}
                </div>
              )}
              {showProductDropdown && productSearch && filteredProductsForStock.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    padding: "10px",
                    zIndex: 1000,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    marginTop: "4px",
                  }}
                >
                  No products found
                </div>
              )}
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-group" style={{ flex: 1.5 }}>
              <label>
                {stockForm.transactionType === "in" ? "Quantity to Add" : "Quantity to Remove"}
              </label>
              <input
                type="number"
                name="quantity"
                placeholder="0"
                value={stockForm.quantity}
                onChange={handleStockChange}
                required
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select
                name="unit"
                value={stockForm.unit}
                onChange={handleStockChange}
              >
                <option value="gallon">Gallon (Set)</option>
                <option value="pail">Pail (Set)</option>
                <option value="L">Liter</option>
                <option value="mL">Milliliter</option>
              </select>
            </div>
          </div>

          {stockForm.transactionType === "in" && (
            <div className="form-row">
              <div className="form-group">
                <label>Cost per Unit</label>
                <input
                  type="number"
                  name="costPerUnit"
                  placeholder="0"
                  value={stockForm.costPerUnit}
                  onChange={handleStockChange}
                  required
                  min="0"
                  step="0.01"
                />
                <small className="hint">Enter the cost per unit for this new stock</small>
              </div>
            </div>
          )}

          <button type="submit" className="submit-btn">
            {stockForm.transactionType === "in" ? "Add Stock" : "Remove Stock"}
          </button>
        </form>
      </div>

      <div className="search-section">
        <h3>Product List</h3>
        <input
          type="text"
          placeholder="Search by brand or item name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Product List by Brand */}
      {Object.keys(filteredProducts).length > 0 ? (
        Object.keys(filteredProducts).map((brand) => (
          <div key={brand} className="brand-section">
            <div className="brand-header">{brand}</div>

            <table className="products-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Profit</th>
                  <th>Stock Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts[brand].map((p) => {
                  const quantity =
                    p.literUnit === "mL"
                      ? parseFloat(p.literValue) / 1000
                      : parseFloat(p.literValue);
                  const isSold = quantity <= 0;
                  const isLowStock = !isSold && p.lowStockThreshold > 0 && quantity <= p.lowStockThreshold;

                  // If this row is being edited, show inputs
                  if (editingId === p.id) {
                    return (
                      <tr
                        key={p.id}
                        className={`editing-row ${isSold ? "row-sold" : ""} ${isLowStock ? "row-low-stock" : ""}`}
                      >
                        <td>
                          <input
                            name="item"
                            value={editData.item}
                            onChange={handleEditChange}
                            style={{ width: "100%" }}
                          />
                        </td>

                        <td>
                          {p.literValue} {p.literUnit}
                        </td>

                        <td>
                          ₱{p.price}{" "}
                          {p.priceUnit === "perPailSet" 
                            ? "per Pail (Set)" 
                            : p.priceUnit === "perGallonSet" 
                            ? "per Gallon (Set)" 
                            : p.priceUnit === "perL" 
                            ? "per L" 
                            : p.priceUnit === "permL" 
                            ? "per mL" 
                            : ""}
                        </td>

                        <td>
                          ₱{Number(p.cost ?? 0).toFixed(2)}
                          {((p.costPerUnit !== undefined && p.costPerUnit !== "") || (p.costPerLiter !== undefined && p.costPerLiter !== "") || (p.costPerL !== undefined)) && (
                            <div style={{ fontSize: 12, marginTop: 4 }}>
                              (₱{Number(p.costPerUnit ?? p.costPerLiter ?? p.costPerL ?? 0).toFixed(2)} per Unit)
                            </div>
                          )}
                        </td>

                        <td>
                          Per Unit: ₱
                          {Number(p.profitPerLiter ?? p.profitPerL ?? 0).toFixed(2)}
                          <br />
                          Total: ₱{Number(p.totalProfit ?? 0).toFixed(2)}
                        </td>

                        <td>
                          <div style={{ marginBottom: "8px" }}>
                            <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
                              Low Stock Threshold:
                            </label>
                            <input
                              type="number"
                              name="lowStockThreshold"
                              value={editData.lowStockThreshold}
                              onChange={handleEditChange}
                              min="0"
                              step="0.1"
                              style={{ width: "100px" }}
                            />
                          </div>
                        </td>

                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => saveEdit(p.id)}
                              className="btn-save"
                            >
                              Save
                            </button>
                            <button onClick={cancelEdit} className="btn-cancel">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Normal (read-only) row
                  return (
                    <tr
                      key={p.id}
                      className={isSold ? "row-sold" : ""}
                    >
                      <td>
                        {p.item}
                        {isSold && (
                          <span className="sold-badge">SOLD</span>
                        )}
                      </td>

                      <td>
                        {p.literValue} {p.literUnit}
                      </td>

                      <td>
                        ₱{p.price}{" "}
                        {p.priceUnit === "perPailSet" 
                          ? "per Pail (Set)" 
                          : p.priceUnit === "perGallonSet" 
                          ? "per Gallon (Set)" 
                          : p.priceUnit === "perL" 
                          ? "per L" 
                          : p.priceUnit === "permL" 
                          ? "per mL" 
                          : ""}
                      </td>

                      <td>
                        ₱{Number(p.cost ?? 0).toFixed(2)}
                        {((p.costPerUnit !== undefined && p.costPerUnit !== "") || (p.costPerLiter !== undefined && p.costPerLiter !== "") || (p.costPerL !== undefined)) && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            (₱{Number(p.costPerUnit ?? p.costPerLiter ?? p.costPerL ?? 0).toFixed(2)} per Unit)
                          </div>
                        )}
                      </td>

                      <td>
                        Per Unit: ₱
                        {Number(p.profitPerLiter ?? p.profitPerL ?? 0).toFixed(
                          2
                        )}
                        <br />
                        Total: ₱{Number(p.totalProfit ?? 0).toFixed(2)}
                      </td>

                      <td className={isLowStock ? 'low-stock' : isSold ? 'sold' : 'in-stock'}>
                        {isSold ? (
                          <span>Sold Out</span>
                        ) : p.lowStockThreshold ? (
                          <>
                            <div>Current: {quantity.toFixed(2)} {p.literUnit}</div>
                            <div>Alert at: {p.lowStockThreshold}qty</div>
                            {isLowStock && <div className="low-stock-badge">LOW STOCK</div>}
                          </>
                        ) : (
                          <div>{quantity.toFixed(2)} {p.literUnit}</div>
                        )}
                      </td>

                      <td>
                        <div className="action-buttons">
                          {!isStaff && (
                            <button
                              onClick={() => startEdit(p)}
                              className="btn-edit"
                            >
                              Edit
                            </button>
                          )}
                          {!isStaff && (
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="btn-delete"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
          <p>No products found. Try adjusting your search or add a new product.</p>
        </div>
      )}
    </div>
  );
};

export default Product;
