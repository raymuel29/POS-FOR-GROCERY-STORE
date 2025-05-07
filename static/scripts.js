if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/static/service-worker.js')
        .then(reg => console.log('Service Worker registered!', reg))
        .catch(err => console.error('Service Worker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('isLoggedIn')) {
        updateProfileDetails();
        showCorrectUI();
        loadWorkLog();
        loadInventory();
        loadProducts();
        fetchOrderHistory();
    } else {
        showLoadingPanelWithTransition();
    }
});

let selectedRole = null;

function setRole(role) {
    selectedRole = role;
}

function submitLogin(event) {
    event.preventDefault();
    if (!selectedRole) {
        alert("Please select a role before logging in.");
        return;
    }

    handleLogin(selectedRole);
}

function handleLogin(role) {
    let username = document.getElementById('login-username').value;
    let password = document.getElementById('login-password').value;

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('role', data.role);
            localStorage.setItem('name', data.name);
            localStorage.setItem('gender', data.gender);
            localStorage.setItem('age', data.age);
            localStorage.setItem('address', data.address);
            localStorage.setItem('birthdate', data.birthdate);
            localStorage.setItem('contact_no', data.contact_no);

            updateProfileDetails();
            showCorrectUI();
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error connecting to server.');
    });
}

function showCorrectUI() {
    document.querySelector('.loading-panel').style.display = 'none';
    document.querySelector('.security').style.display = 'none';
    document.querySelector('.point-of-sale').style.display = 'block';

    const role = localStorage.getItem('role');
    const hasReloaded = localStorage.getItem('hasReloaded');

    if (role === 'admin') {
        document.getElementById('menu-toggle').style.display = 'block';

        if (!hasReloaded) {
            localStorage.setItem('hasReloaded', 'true');
            // Prevent multiple reloads by using setTimeout
            setTimeout(() => {
                document.getElementById("dashboard").style.display = "block";
                location.reload();
            }, 10); // Short delay for smooth reload
        }
    } else if (role === 'cashier') {
        document.getElementById('pos').style.display = 'block';
        document.getElementById("dashboard").style.display = "none";
        document.getElementById("accounts").style.display = "none";
        document.getElementById("working-log").style.display = "none";
        document.getElementById("inventory").style.display = "none";
        document.getElementById("sales").style.display = "none";
        document.getElementById('menu-toggle').style.display = 'none';
        document.getElementById('calculator-toggle-btn').style.display = 'block';
    }
}

function updateProfileDetails() {
    const name = localStorage.getItem('name') || "N/A";
    document.getElementById('full-name').textContent = name;
    document.getElementById('address').textContent = localStorage.getItem('address') || "N/A";
    document.getElementById('age').textContent = localStorage.getItem('age') || "N/A";
    document.getElementById('birth-year').textContent = localStorage.getItem('birthdate') || "N/A";
    document.getElementById('contact-no').textContent = localStorage.getItem('contact_no') || "N/A";
    
    document.getElementById('cashier-name').textContent = name;
}

function updateReceiptCashierName() {
    const cashierName = localStorage.getItem('name') || 'N/A';
    document.getElementById('cashier-name').textContent = cashierName;
}

function confirmSignOut() {
    const name = localStorage.getItem('name'); 

    if (confirm("Are you sure you want to sign out?")) {
        fetch('/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }) 
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Clear stored login data
                localStorage.clear();

                // Clear actual input fields you use
                document.getElementById('login-username').value = "";
                document.getElementById('login-password').value = "";

                // Hide POS UI
                document.querySelector('.point-of-sale').style.display = 'none';

                // Show login panel
                showLoadingPanelWithTransition();
            } else {
                alert("Logout failed. Please try again.");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Error connecting to the server.");
        });
    }
}

function loadWorkLog() {
    fetch('/get_work_logs')
    .then(response => response.json())
    .then(data => {
        const tableBody = document.querySelector("#work-log-table tbody");
        tableBody.innerHTML = ""; // Clear existing data

        data.forEach(record => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${record.employee_name}</td>
                <td>${record.date}</td>
                <td>${record.time_in}</td>
                <td>${record.time_out || 'Still Working'}</td>
                <td>₱${record.total_sales}</td> <!-- Add total_sales column -->
            `;
            tableBody.appendChild(row);
        });
    })
    .catch(error => console.error("Error loading work log:", error));
}

function showLoadingPanelWithTransition() {
    document.querySelector('.loading-panel').style.display = 'flex';
    document.querySelector('.security').style.display = 'none';
    document.querySelector('.point-of-sale').style.display = 'none';

    setTimeout(() => {
        document.querySelector('.loading-panel').style.display = 'none';
        document.querySelector('.security').style.display = 'flex';
    }, 3000); 
}

let calculatorValue = ""; 
let currentOperation = null; 
let firstOperand = null; 

function appendNumber(number) {
    if (calculatorValue === "0" && number !== ".") {
        calculatorValue = "";
    }
    calculatorValue += number;
    updateCalculatorScreen();
}

function appendDecimal() {
    if (!calculatorValue.includes(".")) {
        calculatorValue += ".";
        updateCalculatorScreen();
    }
}

function clearCalculator() {
    calculatorValue = "";
    currentOperation = null;
    firstOperand = null;
    updateCalculatorScreen();
}

function setOperation(operation) {
    if (calculatorValue === "" && firstOperand === null) return;

    if (firstOperand === null) {
        firstOperand = parseFloat(calculatorValue);
    } else if (calculatorValue !== "") {
        calculate(); // Perform calculation if already an operation exists
    }
    currentOperation = operation;
    calculatorValue = "";
}

function calculate() {
    if (currentOperation === null || firstOperand === null || calculatorValue === "") return;

    let secondOperand = parseFloat(calculatorValue);
    let result;
    switch (currentOperation) {
        case "add":
            result = firstOperand + secondOperand;
            break;
        case "subtract":
            result = firstOperand - secondOperand;
            break;
        case "multiply":
            result = firstOperand * secondOperand;
            break;
        case "divide":
            result = firstOperand / secondOperand;
            break;
        default:
            return;
    }

    calculatorValue = result.toString();
    firstOperand = null; // Reset for the next operation
    currentOperation = null;
    updateCalculatorScreen();
}

function updateCalculatorScreen() {
    const screen = document.getElementById("calculator-screen");
    screen.value = calculatorValue || "0";
}

function updateCalculatorWithTotal(total) {
    calculatorValue = total.toString();
    updateCalculatorScreen();
}

const receiptTotal = 0; 
if (receiptTotal > 0) {
    updateCalculatorWithTotal(receiptTotal);
}

function toggleCalculator() {
    const calculatorSection = document.querySelector('.section.calculator');
    const productGrid = document.querySelector('#product-grid'); 
    const receiptHistory = document.querySelector('.receipt-history'); 

    if (calculatorSection.classList.contains('hidden')) {
        calculatorSection.classList.remove('hidden');
        productGrid.style.flex = '4.5'; 
        receiptHistory.style.flex = '3'; 
    } else {
        calculatorSection.classList.add('hidden');
        productGrid.style.flex = '8'; 
        receiptHistory.style.flex = '2'; 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const calculatorSection = document.querySelector('.section.calculator');
    const productGrid = document.querySelector('#product-grid');
    const receiptHistory = document.querySelector('.receipt-history');

    calculatorSection.classList.add('hidden');
    productGrid.style.flex = '8';
    receiptHistory.style.flex = '2';
});

function calculateChange() {
    const totalAmount = parseFloat(document.getElementById('total-amount').textContent.replace('₱', '')) || 0;
    const cashAmount = parseFloat(document.getElementById('cash-amount').value) || 0;
    const changeAmount = cashAmount - totalAmount;
    document.getElementById('change-amount').textContent = changeAmount >= 0 ? `${changeAmount.toFixed(2)}` : '0.00';
}

document.addEventListener('DOMContentLoaded', function () {
    const receiptBody = document.getElementById('receipt-body');
    const totalAmountEl = document.getElementById('total-amount');
    const cashInput = document.getElementById('cash-amount');
    const changeAmountEl = document.getElementById('change-amount');
    const resetButton = document.getElementById('reset-receipt');
    
    let totalAmount = 0;

    const pendingRestore = JSON.parse(localStorage.getItem('pendingRestore') || '[]');
    if (pendingRestore.length > 0) {
        (async () => {
            for (const item of pendingRestore) {
                await restoreStock(item.product_name, item.quantity);
            }
            localStorage.removeItem('pendingRestore');
        })();
    }

    document.addEventListener('click', async function (event) {
        if (event.target.classList.contains('add-button')) {
            const productCard = event.target.closest('.product-card');
            const productName = productCard.querySelector('.product-name').textContent;
            const productPrice = parseFloat(productCard.querySelector('.product-price').textContent.replace('₱', ''));
            const stockEl = productCard.querySelector('.product-stock');
            const quantityInput = productCard.querySelector('.quantity-input');
            let stock = parseInt(stockEl.textContent.replace('Stock: ', ''));
    
            let inputQuantity = parseInt(quantityInput.value);
            if (isNaN(inputQuantity) || inputQuantity <= 0) {
                inputQuantity = 1;
            }
    
            if (inputQuantity > stock) {
                alert(`Not enough stock! Only ${stock} item(s) left.`);
                return;
            }
    
            if (stock <= 20) {
                alert(stock <= 0 ? 'Out of stock!' : 'Critical stock!');
                if (stock <= 0) return;
            }
    
            const response = await fetch('/update_stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name: productName, quantity: -inputQuantity })
            });
    
            const data = await response.json();
    
            if (!data.success) {
                alert(data.error);
                return;
            }
    
            stock -= inputQuantity;
            stockEl.textContent = `Stock: ${stock}`;
    
            let existingRow = Array.from(receiptBody.children).find(row =>
                row.querySelector('.product-name').textContent === productName
            );
    
            if (existingRow) {
                let quantityCell = existingRow.querySelector('.product-quantity');
                let totalCell = existingRow.querySelector('.product-total');
                let currentQuantity = parseInt(quantityCell.textContent);
                let newQuantity = currentQuantity + inputQuantity;
                quantityCell.textContent = newQuantity;
                totalCell.textContent = `₱${(newQuantity * productPrice).toFixed(2)}`;
            } else {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td class="product-name">${productName}</td>
                    <td class="product-price">₱${productPrice.toFixed(2)}</td>
                    <td class="product-quantity">${inputQuantity}</td>
                    <td class="product-total">₱${(inputQuantity * productPrice).toFixed(2)}</td>
                    <td>
                        <button class="delete-button">🗑️</button>
                    </td>
                `;
                receiptBody.appendChild(newRow);
            }
    
            updateTotalAmount();
            quantityInput.value = 1;
        }
    });
        
    function updateTotalAmount() {
        totalAmount = Array.from(receiptBody.children).reduce((sum, row) => {
            return sum + parseFloat(row.querySelector('.product-total').textContent.replace('₱', ''));
        }, 0);
        totalAmountEl.textContent = totalAmount.toFixed(2);
    }

    receiptBody.addEventListener('click', async function (event) {
        if (event.target.classList.contains('delete-button')) {
            const row = event.target.closest('tr');
            const productName = row.querySelector('.product-name').textContent;
            const quantity = parseInt(row.querySelector('.product-quantity').textContent);

            await restoreStock(productName, quantity);

            row.remove();
            updateTotalAmount();
        }
    });

    async function restoreStock(productName, quantity) {
        try {
            const response = await fetch('/update_stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name: productName, quantity })
            });
            const data = await response.json();

            if (data.success) {
                const productCard = Array.from(document.querySelectorAll('.product-card')).find(card =>
                    card.querySelector('.product-name').textContent === productName
                );
                if (productCard) {
                    const stockEl = productCard.querySelector('.product-stock');
                    stockEl.textContent = `Stock: ${data.new_quantity}`;
                }
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error restoring stock:', error);
        }
    }

    resetButton.addEventListener('click', async function () {
        const items = Array.from(receiptBody.children).map(row => ({
            product_name: row.querySelector('.product-name').textContent,
            quantity: parseInt(row.querySelector('.product-quantity').textContent)
        }));

        if (items.length === 0) return;

        try {
            for (const item of items) {
                await restoreStock(item.product_name, item.quantity);
            }

            receiptBody.innerHTML = '';
            totalAmount = 0;
            updateTotalAmount();
            cashInput.value = '';
            changeAmountEl.textContent = '0.00';
            localStorage.removeItem('pendingRestore'); 
        } catch (error) {
            console.error('Error resetting stock:', error);
            alert('Failed to reset stock.');
        }
    });

    cashInput.addEventListener('input', function () {
        const cash = parseFloat(cashInput.value) || 0;
        const change = cash - totalAmount;
        changeAmountEl.textContent = change >= 0 ? change.toFixed(2) : '0.00';
    });

    window.addEventListener('beforeunload', () => {
        const items = Array.from(receiptBody.children).map(row => ({
            product_name: row.querySelector('.product-name').textContent,
            quantity: parseInt(row.querySelector('.product-quantity').textContent)
        }));
        localStorage.setItem('pendingRestore', JSON.stringify(items));
    });
});

const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

function printReceipt() {
    const cashAmount = document.getElementById('cash-amount').value;
    const totalAmount = parseFloat(document.getElementById('total-amount').textContent);

    if (!cashAmount || parseFloat(cashAmount) < totalAmount) {
        alert("Please enter a valid cash amount greater than or equal to the total amount.");
        return;
    }

    const cashierName = localStorage.getItem('name') || 'N/A';
    const date = `${year}-${month}-${day}`;
    document.getElementById('receipt-date').textContent = date;

    const changeAmount = document.getElementById('change-amount').textContent;
    let receiptBody = "";
    document.querySelectorAll("#receipt-body tr").forEach(row => {
        let cells = Array.from(row.cells).slice(0, -1); 
        receiptBody += `<tr>${cells.map(cell => `<td>${cell.textContent}</td>`).join('')}</tr>`;
    });

    let totalMarketPrice = 0;
    let items = [];
    const referenceNumber = 'REF' + Date.now();

    let productNames = []; 
    document.querySelectorAll("#receipt-body tr").forEach(row => {
        let name = row.cells[0].textContent;
        let quantity = parseInt(row.cells[2].textContent);
        productNames.push(name); 
        items.push({ name, quantity }); 
    });

    fetch('/get_market_prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productNames })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert("Error fetching market prices: " + data.error);
            return;
        }

        items.forEach(item => {
            let marketPrice = data[item.name] || 0; 
            let itemTotal = marketPrice * item.quantity;
            totalMarketPrice += itemTotal;
            item.marketPrice = marketPrice;
            item.itemTotal = itemTotal;
        });

        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false });

        fetch('/save_sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                date, 
                time, 
                totalAmount,
                totalMarketPrice,
                items: productNames
            })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message || "Error: " + data.error);
            if (typeof fetchSalesData === 'function') fetchSalesData();
        })
        .catch(error => {
            console.error('Save sale fetch error:', error);
        });

        fetch('/save_receipt_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                referenceNumber,
                date,
                time,
                cashierName,
                items: receiptBody,
                totalAmount,
                cashAmount: parseFloat(cashAmount),
                changeAmount: parseFloat(changeAmount)
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log(data.message || data.error);

            document.getElementById('receipt-body').innerHTML = '';
            document.getElementById('total-amount').textContent = '0.00';
            document.getElementById('cash-amount').value = ''; 
            document.getElementById('change-amount').textContent = '0.00';
        })
        .catch(error => {
            console.error('Save receipt history fetch error:', error);
        });

        const printableContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; width: 300px; text-align: center; margin: 0 auto;">
                <h2>Barrion Grocery Store</h2>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Cashier:</strong> ${cashierName}</p>
                <p><strong>Address:</strong> <span>Brgy.Sampaloc Talisay Batangas</span></p>
                <hr>
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 14px; margin: 5px;">
                    <thead>
                        <tr>
                            <th>Product</th><th>Price</th><th>Qty</th><th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${receiptBody}</tbody>
                </table>
                <hr>
                <p><strong>Total Amount:</strong> ₱${totalAmount.toFixed(2)}</p>
                <p><strong>Cash:</strong> ₱${parseFloat(cashAmount).toFixed(2)}</p>
                <p><strong>Change:</strong> ₱${changeAmount}</p>
                <hr>
                <p>Thank you for shopping!</p>
                <p><strong>Reference No:</strong> ${referenceNumber}</p>
            </div>
        `;

        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Receipt</title></head><body>');
        printWindow.document.write(printableContent);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    });
}

const date = `${year}-${month}-${day}`;
document.getElementById('receipt-date').textContent = date;

async function filterProducts() {
    const searchInput = document.getElementById('product-search').value.trim();
    
    try {
        const response = await fetch(`/filter-products?search=${encodeURIComponent(searchInput)}`);
        const products = await response.json();

        const productGrid = document.getElementById('product-grid');
        productGrid.innerHTML = ''; // Clear the grid before displaying new products

        if (products.length === 0) {
            productGrid.innerHTML = '<p>No products found.</p>';  // Optional message for no results
        }

        products.forEach(product => {
            productGrid.innerHTML += `
                <div class="product-card" data-id="${product.id}">
                    <img src="data:image/png;base64,${product.image || 'default-image.jpg'}" alt="${product.name}">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-price">₱${product.shop_price.toFixed(2)}</p>
                    <p class="product-stock">Stock: ${product.quantity}</p>
                    <input type="number" class="quantity-input" value="1" min="1" max="${product.quantity}">
                    <button class="add-button" ${product.quantity === 0 ? 'disabled' : ''}>
                        ${product.quantity === 0 ? 'Out of Stock' : 'ADD'}
                    </button>
                </div>
            `;
        });

    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.querySelector(".menu-sidebar");
    const menuToggle = document.getElementById("menu-toggle");
    const sidebarLinks = document.querySelectorAll(".menu-sidebar nav ul li a");
    const sections = document.querySelectorAll(".section");
    const profileSidebar = document.getElementById("profile-right-sidebar");
    const main = document.querySelector("main");
  
    let rightSidebarTimeout = null;
  
    menuToggle.addEventListener("click", function () {
      if (profileSidebar.classList.contains("active")) {
        profileSidebar.classList.remove("active");
        main.classList.remove("shrink-right");
        clearTimeout(rightSidebarTimeout);
      }
  
      sidebar.classList.toggle("show");
      if (sidebar.classList.contains("show")) {
        main.classList.add("shrink-left");
  
      } else {
        main.classList.remove("shrink-left");
      }
    });
  
    sidebarLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
  
        sidebarLinks.forEach((link) => link.classList.remove("active"));
        link.classList.add("active");
  
        sections.forEach((section) => section.classList.remove("active"));
  
        const sectionId = link.getAttribute("data-section");
        document.getElementById(sectionId).classList.add("active");
  
        sidebar.classList.remove("show");
        main.classList.remove("shrink-left");
  
      });
    });
  
    function toggleUserRightSidebar() {
      if (sidebar.classList.contains("show")) {
        sidebar.classList.remove("show");
        main.classList.remove("shrink-left");
      }
  
      profileSidebar.classList.toggle("active");
      if (profileSidebar.classList.contains("active")) {
        main.classList.add("shrink-right");
  
        rightSidebarTimeout = setTimeout(() => {
          profileSidebar.classList.remove("active");
          main.classList.remove("shrink-right");
        }, 10000);
      } else {
        clearTimeout(rightSidebarTimeout);
        main.classList.remove("shrink-right");
      }
    }
 
    document.querySelector(".right-user-icon").addEventListener("click", toggleUserRightSidebar);
});
  
function openCreateModal() {
    document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

function openEditModal(id, name, marketPrice, shopPrice, quantity) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-market-price').value = marketPrice;
    document.getElementById('edit-shop-price').value = shopPrice;
    document.getElementById('edit-quantity').value = quantity;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function openStockModal(id) {
    document.getElementById('stock-id').value = id;
    document.getElementById('additional_stock').value = '';
    document.getElementById('stockModal').style.display = 'flex';
}

function closeStockModal() {
    document.getElementById('stockModal').style.display = 'none';
}

function openLowStockModal(id) {
    const statusCell = document.querySelector(`#low-stock-${id}`);
    const currentLimit = statusCell.dataset.limit; // read latest limit
    document.getElementById("low-stock-id").value = id;
    document.getElementById("low-stock-limit").value = currentLimit;
    document.getElementById("lowStockModal").style.display = "flex";
}

function closeLowStockModal() {
    document.getElementById("lowStockModal").style.display = "none";
}

document.getElementById("lowStockForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("low-stock-id").value;
    const limit = parseInt(document.getElementById("low-stock-limit").value);
    document.querySelector(`#low-stock-${id}`).dataset.limit = limit;

    if (isNaN(limit) || limit <= 0) {
        alert("Please enter a valid stock limit.");
        return;
    }

    fetch(`/set_low_limit/${id}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ low_stock_limit: limit })
    })
    .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
    })
    .then(data => {
        console.log("Server response:", data);
    
        if (data.success) {
            alert("Low stock limit updated.");
            closeLowStockModal();
    
            // 🛠️ Update the dataset limit in the page memory
            const statusCell = document.querySelector(`#low-stock-${id}`);
            statusCell.dataset.limit = limit; // <--- ADD THIS LINE
    
            // Check if quantity is still low or now high
            const currentQuantity = parseInt(statusCell.dataset.quantity);
    
            if (currentQuantity <= limit) {
                statusCell.innerHTML = `<span style="color:red;">Low</span>`;
            } else {
                statusCell.innerHTML = `<span style="color:green;">High</span>`;
            }
    
        } else {
            alert("Failed to update limit: " + (data.error || "Unknown error"));
        }
    })    
});

async function loadInventory() {
    try {
        const response = await fetch('/inventory');
        const items = await response.json();

        const inventoryTableBody = document.querySelector('.inventory-table tbody');
        inventoryTableBody.innerHTML = ''; // Clear current items

        items.forEach(item => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>
                    ${item.image ? `<img src="data:image/png;base64,${item.image}" alt="${item.name}">` : 'No Image'}
                </td>
                <td>${item.name}</td>
                <td>${item.market_price}</td>
                <td>${item.shop_price}</td>
                <td>${item.quantity}</td>
                <td id="low-stock-${item.id}" data-quantity="${item.quantity}">
                    ${item.quantity <= item.low_stock_limit ? 
                        '<span style="color:red;">Low</span>' : 
                        '<span style="color:green;">High</span>'
                    }
                </td>
                <td class="action-buttons">
                    <button class="inventory-button-btn" onclick="openEditModal('${item.id}', '${item.name}', '${item.market_price}', '${item.shop_price}', '${item.quantity}')">Edit</button>
                    <button class="inventory-button-btn" onclick="openStockModal('${item.id}')">Add Stock</button>
                    <button class="inventory-button-btn" onclick="openLowStockModal('${item.id}', '${item.low_stock_limit}')">Set Limit</button>
                    <a href="/delete_item/${item.id}">
                        <button class="delete-btn">Delete</button>
                    </a>
                </td>
            `;

            inventoryTableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Failed to load inventory:', error);
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/get_products');
        const items = await response.json();

        const productGrid = document.getElementById('product-grid');
        productGrid.innerHTML = '';

        items.forEach(item => {
            const productCard = `
                <div class="product-card" data-id="${item.id}">
                    ${item.image ? `<img src="data:image/png;base64,${item.image}" alt="${item.name}">` : 'No Image'}
                    <h3 class="product-name">${item.name}</h3>
                    <p class="product-price">₱${item.shop_price}</p>
                    <p class="product-stock">Stock: ${item.quantity}</p>
                    <input type="number" class="quantity-input" value="1" min="1" max="${item.quantity}">
                    <button class="add-button" ${item.quantity === 0 ? 'disabled' : ''}>
                        ${item.quantity === 0 ? 'Out of Stock' : 'ADD'}
                    </button>
                </div>
            `;
            productGrid.innerHTML += productCard;
        });
    } catch (err) {
        console.error('Failed to load products:', err);
    }
}

document.getElementById('product-inventory-search').addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const tableRows = document.querySelectorAll('.inventory-table tbody tr');

    tableRows.forEach(row => {
        const productName = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        row.style.display = productName.includes(searchTerm) ? '' : 'none';
    });
});

async function addProduct(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const response = await fetch('/add_item', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.status === 'success') {
        alert(result.message);
        closeCreateModal();
        loadInventory();
        loadProducts();
    } else {
        alert(result.message || 'Failed to add product.');
    }
}

async function addStock(event) {
    event.preventDefault();

    const id = document.getElementById('stock-id').value;
    const amount = parseInt(document.getElementById('additional_stock').value);

    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid stock amount.');
        return;
    }

    const formData = new FormData();
    formData.append('additional_stock', amount);

    const response = await fetch(`/add_stock/${id}`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.status === 'success') {
        alert(result.message);
        closeStockModal();
        loadInventory();
        loadProducts();
    } else {
        alert(result.message || 'Failed to add stock.');
    }
}

async function editProduct(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const id = formData.get('id');

    const response = await fetch(`/edit_item/${id}`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.status === 'success') {
        alert(result.message);
        closeEditModal();
        loadInventory();
        loadProducts();
    } else {
        alert(result.message || 'Failed to update product.');
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const response = await fetch(`/delete_item/${id}`, {
        method: 'DELETE'
    });

    const result = await response.json();

    if (result.status === 'success') {
        alert(result.message);
        loadInventory();
        loadProducts();
    } else {
        alert(result.message || 'Failed to delete product.');
    }
}

function printInventoryReceipt() {
    const rows = document.querySelectorAll(".inventory-table tbody tr");
    let html = `
        <html>
        <head>
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    padding: 8px;
                    text-align: center;
                    /* Removed border: 1px solid #333; */
                }
                h2 {
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <h2>Inventory Report</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Market Price</th>
                        <th>Shop Price</th>
                        <th>Quantity</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        html += `
            <tr>
                <td>${cells[1].innerText}</td>
                <td>${cells[2].innerText}</td>
                <td>${cells[3].innerText}</td>
                <td>${cells[4].innerText}</td>
                <td>${cells[5].innerText}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '', 'height=800,width=1500');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

document.querySelector('#createForm').addEventListener('submit', addProduct);
document.querySelector('#stockForm').addEventListener('submit', addStock);
document.querySelector('#editForm').addEventListener('submit', editProduct);

async function fetchSalesData(type) {
    try {
        const response = await fetch(`/api/sales/${type}`);
        const salesData = await response.json();

        if (!Array.isArray(salesData) || salesData.length === 0) {
            document.getElementById("sales-table").innerHTML = `<p class="no-data">No ${type} sales data available.</p>`;
            return;
        }

        updateSalesTable(salesData, type);
    } catch (error) {
        console.error("Error fetching sales data:", error);
    }
}

function updateSalesTable(salesData, type) {
    const tableContainer = document.getElementById("sales-table");
    tableContainer.innerHTML = '';

    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>${type === "monthly" ? "Month-Year" : type === "yearly" ? "Year" : type === "weekly" ? "Week Range" : "Date"}</th>
                <th>Total Sales</th>
            </tr>
        </thead>
        <tbody>
            ${salesData.map(sale => `
                <tr>
                    <td>${sale.date}</td>
                    <td>₱${parseFloat(sale.total_shop_price).toFixed(2)}</td> 
                </tr>
            `).join('')}
        </tbody>
    `;

    tableContainer.appendChild(table);
}

document.getElementById("daily-btn").addEventListener("click", () => fetchSalesData("daily"));
document.getElementById("weekly-btn").addEventListener("click", () => fetchSalesData("weekly"));
document.getElementById("monthly-btn").addEventListener("click", () => fetchSalesData("monthly"));
document.getElementById("yearly-btn").addEventListener("click", () => fetchSalesData("yearly"));

document.addEventListener("DOMContentLoaded", () => fetchSalesData("daily"));

document.addEventListener('DOMContentLoaded', function () {
    const tableBody = document.querySelector('#accounts_table tbody');
    const addModal = document.getElementById('addCashierModal');
    const editModal = document.getElementById('editCashierModal');
    const form = document.getElementById('addCashierForm');
    const editForm = document.getElementById('editCashierForm');

    document.getElementById('openModalBtn').onclick = () => addModal.style.display = 'flex';
    document.getElementById('closeModal').onclick = () => addModal.style.display = 'none';
    document.getElementById('closeEditModal').onclick = () => editModal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === addModal) addModal.style.display = 'none';
        if (e.target === editModal) editModal.style.display = 'none';
    };

    // Add cashier
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(form).entries());
        const res = await fetch('/add_cashier', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(formData)
        });
        const result = await res.json();
        if (result.success) {
            alert('Cashier added');
            addModal.style.display = 'none';
            form.reset();
            loadCashiers();
        } else alert(result.message);
    });

    // Edit cashier
    editForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(editForm).entries());
        const res = await fetch('/edit_cashier', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert('Cashier updated');
            editModal.style.display = 'none';
            loadCashiers();
        } else alert(result.message);
    });

    // Load cashier data to table
    async function loadCashiers() {
        tableBody.innerHTML = '';
        const res = await fetch('/get_all_cashiers');
        const cashiers = await res.json();

        cashiers.forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${c.name}</td>
                <td>${c.gender}</td>
                <td>${c.age}</td>
                <td>${c.address}</td>
                <td>${c.contact_no}</td>
                <td>${c.username}</td>
                <td>${c.password}</td>
                <td>${c.role}</td>
                <td>
                    <button class="editBtn">Edit</button>
                    <button class="deleteBtn">Delete</button>
                </td>
            `;
            // Attach event listeners
            row.querySelector('.editBtn').onclick = () => openEditModal(c);
            row.querySelector('.deleteBtn').onclick = () => deleteCashier(c.username);
            tableBody.appendChild(row);
        });
    }

    // Open edit modal with data
    function openEditModal(data) {
        for (const key in data) {
            const field = editForm.elements[key];
            if (field) field.value = data[key];
        }
        editForm.elements.original_username.value = data.username;
        editModal.style.display = 'flex';
    }

    // Delete cashier
    async function deleteCashier(username) {
        if (confirm(`Delete ${username}?`)) {
            const res = await fetch('/delete_cashier', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username })
            });
            const result = await res.json();
            if (result.success) {
                alert('Cashier deleted');
                loadCashiers();
            } else alert(result.message);
        }
    }

    // Initial load
    loadCashiers();
});

function fetchOrderHistory() {
    fetch('/get_history')  
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert("Error fetching order history: " + data.error);
            return;
        }

        const orderList = document.getElementById('orderList');
        orderList.innerHTML = '';  

        data.orders.forEach(order => {
            const orderItem = document.createElement('div');
            orderItem.classList.add('order-item');
            orderItem.textContent = `Ref No: ${order.referenceNumber} | Date: ${order.date}`;
            orderItem.onclick = () => openReceiptModal(order.referenceNumber);
            orderList.appendChild(orderItem);
        });
    })
    .catch(error => {
        console.error('Error fetching order history:', error);
    });
}

function openReceiptModal(referenceNumber) {
    fetch(`/get_receipt/${referenceNumber}`) 
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert("Error fetching receipt details: " + data.error);
            return;
        }

        console.log("Fetched data:", data);  

        if (Array.isArray(data.items)) {
            const modalContent = document.getElementById('modalReceiptContent');
            modalContent.innerHTML = `
                <h3>Barrion Grocery Store</h3>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Cashier:</strong> ${data.cashier}</p>
                <p><strong>Address:</strong> <span>N/A</span></p>
                <hr>
                <table class="history-items-table">
                    <thead>
                        <tr>
                            <th>Product</th><th>Price</th><th>Qty</th><th>Total</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        ${data.items.map(item => `
                            <tr>
                                <td class="history-details">${item.product}</td> <!-- Change name to product -->
                                <td class="history-details">₱${item.price.toFixed(2)}</td>
                                <td class="history-details">${item.quantity}</td>
                                <td class="history-details">₱${item.total.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <hr>
                <p><strong>Total Amount:</strong> ₱${data.totalAmount.toFixed(2)}</p>
                <p><strong>Cash:</strong> ₱${data.cash.toFixed(2)}</p>
                <p><strong>Change:</strong> ₱${data.change.toFixed(2)}</p>
                <hr>
                <p>Thank you for shopping!</p>
                <h4>${data.referenceNumber}</h4>
            `;
        } else {
            alert('Error: Items data is not in the correct format.');
        }

        // Show the modal
        const modal = document.getElementById('receiptModal');
        modal.style.display = 'flex';
    })
    .catch(error => {
        console.error('Error fetching receipt details:', error);
    });
}

function filterOrders() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const dateFilter = document.getElementById('dateFilter').value;

    const orderItems = document.querySelectorAll('.order-item');

    orderItems.forEach(item => {
        const referenceNumber = item.textContent.split(' | ')[0].replace('Ref No: ', '');
        const itemDate = item.textContent.split(' | ')[1].replace('Date: ', '');

        // Filter by reference number or date
        const matchesSearch = referenceNumber.toLowerCase().includes(searchInput);
        const matchesDate = dateFilter ? itemDate === dateFilter : true;

        if (matchesSearch && matchesDate) {
            item.style.display = 'block'; // Show matching items
        } else {
            item.style.display = 'none'; // Hide non-matching items
        }
    });
}

document.getElementById('closeHistoryModal').addEventListener('click', () => {
    const modal = document.getElementById('receiptModal');
    modal.style.display = 'none';
});




