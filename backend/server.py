import datetime
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import jwt
from functools import wraps

app = Flask(__name__)
CORS(app)  # Allow frontend to access APIs

# Database config (SQLite for development)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///recipes.db'
app.config['SECRET_KEY'] = 'your-secret-key'  # Change in production!
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Models (SQL Tables)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    avatar = db.Column(db.String(200))
    recipes = db.relationship('Recipe', backref='author', lazy=True)
    blogs = db.relationship('Blog', backref='author', lazy=True)

class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    ingredients = db.Column(db.Text, nullable=False)  # Store as JSON string
    image = db.Column(db.String(200))
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)

class Blog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(200))
    content_image = db.Column(db.String(200))
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)

# Create tables
with app.app_context():
    db.create_all()

# JWT Authentication Middleware
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('sessionToken')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Routes
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_user = User(
        name=data['name'],
        email=data['email'],
        password=hashed_password,
        avatar=data.get('avatar', 'default-avatar.png')
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User created!'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if not user or not bcrypt.check_password_hash(user.password, data['password']):
        return jsonify({'message': 'Invalid credentials!'}), 401
    
    # Create JWT token
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    # Set cookie
    response = make_response(jsonify({'message': 'Logged in!'}))
    response.set_cookie(
        'sessionToken',
        token,
        httponly=True,
        secure=True,  # HTTPS only
        samesite='Lax',
        max_age=604800  # 7 days
    )
    return response

@app.route('/api/recipes', methods=['GET'])
@token_required
def get_recipes(current_user):
    recipes = Recipe.query.filter(
        (Recipe.author_id == current_user.id) | (Recipe.is_public == True)
    ).all()
    return jsonify([{
        'id': r.id,
        'name': r.name,
        'description': r.description,
        'ingredients': r.ingredients,
        'image': r.image,
        'author': r.author.name
    } for r in recipes])

# Add more routes for blogs, recipe uploads, etc.

if __name__ == '__main__':
    app.run(debug=True)