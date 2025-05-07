from flask import Flask, render_template, request, redirect, url_for, jsonify
import sqlite3
import json
from datetime import datetime, timedelta
import base64
from bs4 import BeautifulSoup


app = Flask(__name__, static_folder='static')


@app.route('/')
def home():
    return redirect(url_for('index'))

@app.route('/index')
def index():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('SELECT * FROM inventory WHERE quantity > 0')
    items = cursor.fetchall()
    connection.close()
    return render_template('index.html', items=items)

def get_db_connection():
    connection = sqlite3.connect('inventory.db')
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            market_price REAL DEFAULT 0,
            shop_price REAL DEFAULT 0,
            stock_purchased INTEGER DEFAULT 0,
            image BLOB,
            low_stock_limit INTEGER DEFAULT 0
        )
    """)

    connection.commit()
    connection.close()

@app.template_filter('b64encode')
def b64encode(data):
    return base64.b64encode(data).decode('utf-8') if data else ''

@app.route('/inventory', methods=['GET'])
def inventory_page():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('SELECT * FROM inventory')
    items = cursor.fetchall()
    connection.close()

    items_data = [{
        'id': item['id'],
        'name': item['name'],
        'quantity': item['quantity'],
        'market_price': item['market_price'],
        'shop_price': item['shop_price'],
        'stock_purchased': item['stock_purchased'],
        'low_stock_limit': item['low_stock_limit'],
        'image': base64.b64encode(item['image']).decode('utf-8') if item['image'] else None
    } for item in items]

    return jsonify(items_data)

@app.route('/add_item', methods=['POST'])
def add_item():
    name = request.form['name']
    quantity = int(request.form['quantity'])
    market_price = float(request.form['market_price'])
    shop_price = float(request.form['shop_price'])
    image = request.files.get('image')
    image_data = image.read() if image else None

    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(
        '''INSERT INTO inventory (name, quantity, image, market_price, shop_price) 
           VALUES (?, ?, ?, ?, ?)''',
        (name, quantity, image_data, market_price, shop_price)
    )
    connection.commit()
    connection.close()

    return jsonify({'status': 'success', 'message': 'Item added successfully'})

@app.route('/add_stock/<int:item_id>', methods=['POST'])
def add_stock(item_id):
    try:
        additional_stock = int(request.form.get('additional_stock'))
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT quantity FROM inventory WHERE id = ?", (item_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'status': 'error', 'message': 'Item not found'})

        new_quantity = row['quantity'] + additional_stock

        cur.execute("UPDATE inventory SET quantity = ? WHERE id = ?", (new_quantity, item_id))
        conn.commit()
        return jsonify({'status': 'success', 'message': 'Stock added successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/edit_item/<int:item_id>', methods=['POST'])
def edit_item(item_id):
    name = request.form['name']
    quantity = int(request.form['quantity'])
    market_price = float(request.form['market_price'])
    shop_price = float(request.form['shop_price'])
    new_stock_purchased = request.form.get('stock_purchased', '')
    image = request.files.get('image')
    image_data = image.read() if image else None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT quantity FROM inventory WHERE id = ?", (item_id,))
        current_data = cursor.fetchone()
        current_quantity = current_data['quantity'] if current_data else 0

        if new_stock_purchased:
            new_stock_purchased = int(new_stock_purchased)
            quantity = current_quantity + new_stock_purchased
        else:
            new_stock_purchased = 0

        if image_data:
            cursor.execute(
                '''UPDATE inventory 
                   SET name=?, quantity=?, image=?, market_price=?, shop_price=?, stock_purchased=?
                   WHERE id=?''',
                (name, quantity, image_data, market_price, shop_price, 0, item_id)
            )
        else:
            cursor.execute(
                '''UPDATE inventory 
                   SET name=?, quantity=?, market_price=?, shop_price=?, stock_purchased=?
                   WHERE id=?''',
                (name, quantity, market_price, shop_price, 0, item_id)
            )

        connection.commit()
        connection.close()

        return jsonify({'status': 'success', 'message': 'Item updated successfully'})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/delete_item/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('DELETE FROM inventory WHERE id = ?', (item_id,))
    connection.commit()
    connection.close()

    return jsonify({'status': 'success', 'message': 'Item deleted successfully'})

@app.route('/get_products', methods=['GET'])
def get_products():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('SELECT * FROM inventory')
    items = cursor.fetchall()
    connection.close()

    items_data = [{
        'id': item['id'],
        'name': item['name'],
        'quantity': item['quantity'],
        'market_price': item['market_price'],
        'shop_price': item['shop_price'],
        'low_stock_limit': item['low_stock_limit'],
        'image': base64.b64encode(item['image']).decode('utf-8') if item['image'] else None
    } for item in items]

    return jsonify(items_data)

@app.route('/get_market_prices', methods=['POST'])
def get_market_prices():
    try:
        data = request.json
        product_names = data.get("productNames", [])

        if not product_names:
            return jsonify({"error": "No products provided"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT name, market_price FROM inventory WHERE name IN ({seq})".format(
                seq=','.join(['?'] * len(product_names))
            ),
            product_names
        )

        market_prices = {row[0]: row[1] for row in cursor.fetchall()}
        conn.close()

        return jsonify(market_prices), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update_stock', methods=['POST'])
def update_stock():
    data = request.get_json()
    product_name = data.get('product_name')
    quantity_change = data.get('quantity', 0)

    if not product_name or quantity_change == 0:
        return jsonify({"success": False, "error": "Invalid product name or quantity"})

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "UPDATE inventory SET quantity = quantity + ? WHERE LOWER(name) = LOWER(?)",
            (quantity_change, product_name)
        )
        connection.commit()

        cursor.execute("SELECT quantity FROM inventory WHERE LOWER(name) = LOWER(?)", (product_name,))
        updated_stock = cursor.fetchone()
        connection.close()

        if updated_stock:
            return jsonify({"success": True, "new_quantity": updated_stock["quantity"]})
        else:
            return jsonify({"success": False, "error": "Product not found"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/set_low_limit/<int:id>', methods=['POST'])
def set_low_limit(id):
    try:
        data = request.get_json()
        new_limit = int(data['low_stock_limit'])

        conn = sqlite3.connect('inventory.db')
        c = conn.cursor()
        c.execute('UPDATE inventory SET low_stock_limit = ? WHERE id = ?', (new_limit, id))
        conn.commit()
        conn.close()

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/low_stock_products')
def get_low_stock_products():
    conn = sqlite3.connect('inventory.db')
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT name, quantity FROM inventory WHERE quantity <= low_stock_limit')
        low_stock_items = cursor.fetchall()
        conn.close()

        if not low_stock_items:
            return jsonify([]) 

        low_stock_data = [{'name': item['name'], 'quantity': item['quantity']} for item in low_stock_items]
        return jsonify(low_stock_data)

    except Exception as e:
        conn.close()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/filter-products')
def filter_products():
    search_query = request.args.get('search', '')  

    filtered_products = filter_products_query(search_query)
    
    result = []
    for product in filtered_products:
        product_data = dict(product)  

        if 'image' in product_data and product_data['image']:
            image_data = base64.b64encode(product_data['image']).decode('utf-8')
            product_data['image'] = image_data
        
        result.append(product_data)
    
    return jsonify(result)

def filter_products_query(search_query):
    try:
        conn = get_db_connection()
        query = "SELECT * FROM inventory WHERE name LIKE ?"
        cursor = conn.execute(query, ('%' + search_query + '%',))
        return cursor.fetchall()
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        return []

def get_security_db_connection():
    connection = sqlite3.connect('security.db')
    connection.row_factory = sqlite3.Row
    return connection

def init_security_db():
    connection = get_security_db_connection()
    cursor = connection.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            gender TEXT NOT NULL,
            age TEXT NOT NULL,
            address TEXT NOT NULL,
            birthdate DATE NOT NULL,
            contact_no TEXT NOT NULL
        )
    ''')

    connection.commit()
    connection.close()
    #print("Database reset successfully.")

def authenticate_user(username, password):
    connection = get_security_db_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT role FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()

    connection.close()

    if user:
        return {"success": True, "role": user["role"]}
    return {"success": False}

@app.route('/get_all_cashiers', methods=['GET'])
def get_all_cashiers():
    connection = None
    try:
        connection = get_security_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT username, password, role, name, gender, age, address, birthdate, contact_no FROM users")
        rows = cursor.fetchall()
        result = []
        for row in rows:
            result.append({
                "username": row["username"],
                "password": row["password"],
                "role": row["role"],
                "name": row["name"],
                "gender": row["gender"],
                "age": row["age"],
                "address": row["address"],
                "birthdate": row["birthdate"],
                "contact_no": row["contact_no"]
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if connection:
            connection.close()

@app.route('/edit_cashier', methods=['POST'])
def edit_cashier():
    data = request.json
    connection = None
    try:
        connection = get_security_db_connection()
        cursor = connection.cursor()
        cursor.execute('''
            UPDATE users
            SET username = ?, password = ?, role = ?, name = ?, gender = ?, age = ?, address = ?, birthdate = ?, contact_no = ?
            WHERE username = ?
        ''', (
            data['username'], data['password'], data['role'], data['name'], data['gender'],
            data['age'], data['address'], data['birthdate'], data['contact_no'], data['original_username']
        ))
        connection.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if connection:
            connection.close()

@app.route('/delete_cashier', methods=['POST'])
def delete_cashier():
    data = request.json
    connection = None
    try:
        connection = get_security_db_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM users WHERE username = ?", (data['username'],))
        connection.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if connection:
            connection.close()

@app.route('/add_cashier', methods=['POST'])
def add_cashier():
    data = request.json
    connection = None
    try:
        connection = get_security_db_connection()
        cursor = connection.cursor()
        cursor.execute('''
            INSERT INTO users (username, password, role, name, gender, age, address, birthdate, contact_no)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['username'], data['password'], data['role'], data['name'], data['gender'],
            data['age'], data['address'], data['birthdate'], data['contact_no']
        ))
        connection.commit()
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Username already exists!"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        if connection:
            connection.close()

def get_work_tracker_db_connection():
    connection = sqlite3.connect('work_tracker.db')
    connection.row_factory = sqlite3.Row
    return connection

def init_work_tracker_db():
    connection = get_work_tracker_db_connection()
    cursor = connection.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_name TEXT NOT NULL,
            time_in TEXT NOT NULL,
            time_out TEXT,
            date TEXT NOT NULL,
            total_sales REAL DEFAULT 0.0
        );
    ''')

    connection.commit()
    connection.close()

def log_time_in(employee_name):
    connection = get_work_tracker_db_connection()
    cursor = connection.cursor()

    time_in = datetime.now().strftime("%H:%M:%S")  # Store exact time-in
    date = datetime.now().strftime("%Y-%m-%d")  # Store today's date

    cursor.execute('''
        INSERT INTO attendance (employee_name, time_in, date) VALUES (?, ?, ?)
    ''', (employee_name, time_in, date))

    connection.commit()
    connection.close()

def log_time_out(employee_name):
    connection = get_work_tracker_db_connection()
    cursor = connection.cursor()

    time_out = datetime.now().strftime("%H:%M:%S")
    date = datetime.now().strftime("%Y-%m-%d")

    # Calculate total sales for this cashier on this date from history.db
    history_conn = sqlite3.connect('history.db')
    history_cursor = history_conn.cursor()
    history_cursor.execute('''
        SELECT SUM(total_amount) FROM receipt_history
        WHERE cashier_name = ? AND date = ?
    ''', (employee_name, date))
    result = history_cursor.fetchone()
    total_sales = result[0] if result[0] is not None else 0.0
    history_conn.close()

    # Update time_out and total_sales
    cursor.execute('''
        UPDATE attendance 
        SET time_out = ?, total_sales = ?
        WHERE employee_name = ? AND time_out IS NULL AND date = ?
    ''', (time_out, total_sales, employee_name, date))

    connection.commit()
    connection.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    connection = get_security_db_connection()  # Make sure the database exists
    cursor = connection.cursor()

    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()

    if user:
        user_role = user[3]  # Assuming role is stored in the 4th column

        # ✅ Prevent cross-role login
        if user_role != role:
            return jsonify({"success": False, "message": "Invalid credentials for this role!"}), 403

        # ✅ If cashier logs in, track time-in
        if role == 'cashier':
            log_time_in(user[4])  # Assuming user[4] is the employee_name

        return jsonify({
        "success": True,
        "role": user_role,
        "name": user[4],   
        "gender": user[5],
        "age": user[6],
        "address": user[7],
        "birthdate": user[8],
        "contact_no": user[9]  # Include contact number
    })

    return jsonify({"success": False, "message": "Invalid username or password!"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    data = request.json
    employee_name = data.get('name')

    log_time_out(employee_name)  # Track time-out
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.route('/get_work_logs', methods=['GET'])
def get_work_logs():
    connection = get_work_tracker_db_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT * FROM attendance ORDER BY date ASC, time_in ASC")
    logs = cursor.fetchall()
    connection.close()

    # Convert SQLite rows to JSON format
    work_logs = []
    for log in logs:
        work_logs.append({
            "id": log["id"],
            "employee_name": log["employee_name"],
            "date": log["date"],
            "time_in": log["time_in"],
            "time_out": log["time_out"],
            "total_sales": log["total_sales"]  # Include total_sales field
        })

    return jsonify(work_logs)

@app.route('/update_total_sales', methods=['POST'])
def update_total_sales():
    try:
        # Step 1: Connect to receipt history DB
        history_conn = get_history_db_connection()
        history_cursor = history_conn.cursor()

        # Step 2: Get total sales grouped by cashier and date
        history_cursor.execute('''
            SELECT cashier_name, date, SUM(total_amount)
            FROM receipt_history
            GROUP BY cashier_name, date
        ''')
        sales_data = history_cursor.fetchall()
        history_conn.close()

        # Step 3: Connect to work tracker DB
        tracker_conn = get_work_tracker_db_connection()
        tracker_cursor = tracker_conn.cursor()

        # Step 4: Update the attendance table with total_sales
        for row in sales_data:
            cashier = row[0]
            date = row[1]
            total_sales = row[2]

            # Update only if a matching row exists
            tracker_cursor.execute('''
                UPDATE attendance
                SET total_sales = ?
                WHERE employee_name = ? AND date = ?
            ''', (total_sales, cashier, date))

        tracker_conn.commit()
        tracker_conn.close()

        return jsonify({"message": "Total sales updated successfully in attendance table."})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_sales_db_connection():
    connection = sqlite3.connect('sales.db')
    connection.row_factory = sqlite3.Row  # Allows column access by name
    return connection

def init_sales_db():
    connection = get_sales_db_connection()
    cursor = connection.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,             -- Added time column
            items TEXT NOT NULL,             -- Added items column
            total_market_price REAL NOT NULL,
            total_shop_price REAL NOT NULL
        )
    ''')
    connection.commit()
    connection.close()

@app.route('/save_sale', methods=['POST'])
def save_sale():
    data = request.json
    date = data.get('date')
    time = data.get('time')  # <--- Get the time from frontend
    items = data.get('items')  # <--- Get the items (list of item names)

    total_shop_price = data.get('totalAmount')
    total_market_price = data.get('totalMarketPrice')

    if not date or not time or not items or total_shop_price is None or total_market_price is None:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        conn = get_sales_db_connection()
        cursor = conn.cursor()

        formatted_date = date

        # Convert list of items to a single string (e.g., item1, item2, item3)
        items_string = ', '.join(items) if isinstance(items, list) else items

        cursor.execute("""
        INSERT INTO sales (date, time, items, total_market_price, total_shop_price)
        VALUES (?, ?, ?, ?, ?)
        """, (formatted_date, time, items_string, total_market_price, total_shop_price))

        conn.commit()
        conn.close()

        updated_sales_data = get_total_sales("daily")

        return jsonify({"message": "Sale saved successfully!", "sales_data": updated_sales_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales', methods=['GET'])
def get_sales():
    try:
        connection = get_sales_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT id, date, total_market_price, total_shop_price FROM sales ")
        sales = cursor.fetchall()
        connection.close()

        # Convert to JSON format
        sales_list = [
            {
                "id": row["id"],
                "date": row["date"],
                "total_market_price": row["total_market_price"],
                "total_shop_price": row["total_shop_price"]
            }
            for row in sales
        ]

        return jsonify(sales_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_date_list(start_date, end_date):
    """ Generates a list of all dates from start_date to end_date. """
    date_list = []
    current_date = datetime.strptime(start_date, "%m/%d/%Y")
    end_date = datetime.strptime(end_date, "%m/%d/%Y")

    while current_date <= end_date:
        date_list.append(current_date.strftime("%m/%d/%Y"))
        current_date += timedelta(days=1)

    return date_list

def get_total_sales(time_filter):
    """Retrieves total sales data including market and shop price based on time filter."""
    connection = get_sales_db_connection()
    cursor = connection.cursor()

    results = []

    if time_filter == "daily":
        cursor.execute("""
            SELECT 
                date, 
                SUM(total_shop_price) AS total_shop_price,
                SUM(total_market_price) AS total_market_price
            FROM sales 
            GROUP BY date
        """)
        sales_data = cursor.fetchall()
        results = [
            {
                "date": row["date"],
                "total_shop_price": row["total_shop_price"],
                "total_market_price": row["total_market_price"]
            } for row in sales_data
        ]

    elif time_filter == "weekly":
        cursor.execute("""
            SELECT 
                strftime('%Y-%W', date) AS week_number,
                DATE(MIN(date), 'weekday 0', '-6 days') AS start_date,
                DATE(MIN(date), 'weekday 0') AS end_date,
                SUM(total_shop_price) AS total_shop_price,
                SUM(total_market_price) AS total_market_price
            FROM sales
            GROUP BY week_number
            ORDER BY start_date
        """)
        sales_data = cursor.fetchall()
        results = [
            {
                "date": f"{row['start_date']} to {row['end_date']}",
                "total_shop_price": row["total_shop_price"],
                "total_market_price": row["total_market_price"]
            } for row in sales_data
        ]

    elif time_filter == "monthly":
        cursor.execute("""
            SELECT 
                strftime('%Y-%m', date) AS month,
                SUM(total_shop_price) AS total_shop_price,
                SUM(total_market_price) AS total_market_price
            FROM sales 
            GROUP BY month
        """)
        sales_data = cursor.fetchall()
        results = [
            {
                "date": row["month"],
                "total_shop_price": row["total_shop_price"],
                "total_market_price": row["total_market_price"]
            } for row in sales_data
        ]

    elif time_filter == "yearly":
        cursor.execute("""
            SELECT 
                strftime('%Y', date) AS year,
                SUM(total_shop_price) AS total_shop_price,
                SUM(total_market_price) AS total_market_price
            FROM sales 
            GROUP BY year
        """)
        sales_data = cursor.fetchall()
        results = [
            {
                "date": row["year"],
                "total_shop_price": row["total_shop_price"],
                "total_market_price": row["total_market_price"]
            } for row in sales_data
        ]

    connection.close()
    return results

@app.route('/api/sales/<time_filter>', methods=['GET'])
def sales_report(time_filter):
    """ API route to get sales report based on time filter (daily, weekly, monthly, yearly). """
    sales_data = get_total_sales(time_filter)
    return jsonify(sales_data), 200

@app.route('/api/profit/<time_filter>', methods=['GET'])
def get_profit_data(time_filter):
    """Returns chart data with shop total, market total, and computed profit based on time filter."""
    connection = get_sales_db_connection()
    cursor = connection.cursor()
    result = []

    query_map = {
        "daily": """
            SELECT date,
                   SUM(total_shop_price) AS shop_total,
                   SUM(total_market_price) AS market_total
            FROM sales 
            GROUP BY date
        """,
        "weekly": """
            SELECT strftime('%Y-%W', date) AS week_label,
                   DATE(MIN(date), 'weekday 0', '-6 days') AS start_date,
                   DATE(MIN(date), 'weekday 0') AS end_date,
                   SUM(total_shop_price) AS shop_total,
                   SUM(total_market_price) AS market_total
            FROM sales
            GROUP BY week_label
            ORDER BY start_date
        """,
        "monthly": """
            SELECT strftime('%Y-%m', date) AS month,
                   SUM(total_shop_price) AS shop_total,
                   SUM(total_market_price) AS market_total
            FROM sales 
            GROUP BY month
        """,
        "yearly": """
            SELECT strftime('%Y', date) AS year,
                   SUM(total_shop_price) AS shop_total,
                   SUM(total_market_price) AS market_total
            FROM sales 
            GROUP BY year
        """
    }

    if time_filter not in query_map:
        connection.close()
        return jsonify({"error": "Invalid time filter"}), 400

    cursor.execute(query_map[time_filter])
    sales = cursor.fetchall()

    for row in sales:
        if time_filter == "weekly":
            label = f"{row['start_date']} to {row['end_date']}"
        else:
            label = row["date"] if time_filter == "daily" else row.get("month") or row.get("year")

        result.append({
            "label": label,
            "shop_total": row["shop_total"],
            "market_total": row["market_total"],
            "profit": row["shop_total"] - row["market_total"]
        })

    connection.close()
    return jsonify(result), 200

def get_history_db_connection():
    connection = sqlite3.connect('history.db')
    connection.row_factory = sqlite3.Row  # Enable dictionary-like access
    return connection

def init_history_db():
    connection = get_history_db_connection()
    cursor = connection.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS receipt_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference_number TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            cashier_name TEXT NOT NULL,
            items TEXT NOT NULL,
            total_amount REAL NOT NULL,
            cash_amount REAL NOT NULL,
            change_amount REAL NOT NULL
        )
    ''')

    connection.commit()
    connection.close()

@app.route('/save_receipt_history', methods=['POST'])
def save_receipt_history():
    try:
        data = request.json
        required_fields = ['referenceNumber', 'date', 'time', 'cashierName', 'items', 'totalAmount', 'cashAmount', 'changeAmount']

        # Check for missing fields
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
        
        reference_number = data['referenceNumber']
        date = data['date']
        time = data['time']
        cashier_name = data['cashierName']
        items = data['items']
        total_amount = data['totalAmount']
        cash_amount = data['cashAmount']
        change_amount = data['changeAmount']

        conn = get_history_db_connection()
        cursor = conn.cursor()

        cursor.execute(''' 
            INSERT INTO receipt_history 
            (reference_number, date, time, cashier_name, items, total_amount, cash_amount, change_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (reference_number, date, time, cashier_name, items, total_amount, cash_amount, change_amount))

        conn.commit()
        conn.close()

        return jsonify({"message": "Receipt saved successfully."})

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/get_history', methods=['GET'])
def get_order_history():
    try:
        conn = get_history_db_connection()
        cursor = conn.cursor()
        
        # Query to get all the receipt data
        cursor.execute('SELECT reference_number, date FROM receipt_history')
        orders = cursor.fetchall()
        
        # Format the data as a list of dictionaries
        order_list = [{"referenceNumber": order[0], "date": order[1]} for order in orders]
        
        conn.close()
        return jsonify({"orders": order_list})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_receipt/<referenceNumber>', methods=['GET'])
def get_receipt(referenceNumber):
    try:
        conn = get_history_db_connection()
        cursor = conn.cursor()
        
        # Query to fetch the receipt by reference number
        cursor.execute('SELECT * FROM receipt_history WHERE reference_number = ?', (referenceNumber,))
        receipt = cursor.fetchone()
        
        if receipt:
            # Access each column by name using row's dictionary-like access
            reference_number = receipt['reference_number']
            date = receipt['date']
            time = receipt['time']
            cashier_name = receipt['cashier_name']
            items = receipt['items']
            total_amount = receipt['total_amount']
            cash_amount = receipt['cash_amount']
            change_amount = receipt['change_amount']
            
            # Parse the HTML table rows and convert them to a list of dictionaries
            items_list = []
            if items:
                soup = BeautifulSoup(items, 'html.parser')
                rows = soup.find_all('tr')
                
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) == 4:  # Check if there are 4 columns (name, price, quantity, total)
                        product = cols[0].get_text()
                        price = float(cols[1].get_text().replace('₱', '').strip())
                        quantity = int(cols[2].get_text())
                        total = float(cols[3].get_text().replace('₱', '').strip())
                        
                        # Add the item to the list
                        items_list.append({
                            "product": product,
                            "price": price,
                            "quantity": quantity,
                            "total": total
                        })
            
            # Return the receipt details
            receipt_details = {
                "referenceNumber": reference_number,
                "date": date,
                "time": time,
                "cashier": cashier_name,
                "totalAmount": total_amount,
                "cash": cash_amount,
                "change": change_amount,
                "items": items_list
            }
            
            conn.close()
            return jsonify(receipt_details)
        
        conn.close()
        return jsonify({"error": "Receipt not found"}), 404
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    init_db()  
    init_security_db() 
    init_work_tracker_db()
    init_sales_db()
    init_history_db()

    app.run(debug=True, host='127.0.0.1', port=5000)