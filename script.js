// Database setup for recipes and blogs
const RECIPE_DB = 'recipeFinderRecipes';
const BLOG_DB = 'recipeFinderBlogs';
const USER_DB = 'recipeFinderUsers';

// Global variable for ingredients
let currentIngredients = [];

// Initialize databases if they don't exist
if (!localStorage.getItem(RECIPE_DB)) {
    localStorage.setItem(RECIPE_DB, JSON.stringify([]));
}

if (!localStorage.getItem(BLOG_DB)) {
    localStorage.setItem(BLOG_DB, JSON.stringify([]));
}

if (!localStorage.getItem(USER_DB)) {
    localStorage.setItem(USER_DB, JSON.stringify([]));
}

// XML-related functions
function recipeToXml(recipe) {
    return `
        <recipe>
            <name>${escapeXml(recipe.name)}</name>
            <image>${escapeXml(recipe.image)}</image>
            <ingredients>
                ${recipe.ingredients.map(ing => `<ingredient>${escapeXml(ing)}</ingredient>`).join('')}
            </ingredients>
            <instructions>${escapeXml(recipe.description)}</instructions>
            <author>${escapeXml(recipe.author)}</author>
            <authorEmail>${escapeXml(recipe.authorEmail)}</authorEmail>
            <date>${escapeXml(new Date().toISOString())}</date>
        </recipe>
    `;
}

function escapeXml(unsafe) {
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

async function saveRecipe(name, description, ingredients, imageUrl, author) {
    const recipe = {
        name,
        description,
        ingredients,
        image: imageUrl,
        author: author.name,
        authorEmail: author.email,
        date: new Date().toISOString()
    };

    try {
        // Send to server
        const response = await fetch('http://localhost:3000/recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
            },
            body: recipeToXml(recipe)
        });

        if (!response.ok) throw new Error('Failed to save recipe to server');

        // Also save locally
        const recipes = JSON.parse(localStorage.getItem(RECIPE_DB)) || [];
        recipes.push(recipe);
        localStorage.setItem(RECIPE_DB, JSON.stringify(recipes));

        // Update UI
        alert('Recipe uploaded successfully and shared with everyone!');
        document.getElementById('upload-form').reset();
        document.getElementById('ingredients-list').innerHTML = '';
        currentIngredients = [];
        
        // Refresh data
        await loadRecipesFromServer();
        loadCommunityRecipes();
        loadUserRecipes();
    } catch (error) {
        console.error('Error:', error);
        alert('Error sharing recipe: ' + error.message);
    }
}

async function loadRecipesFromServer() {
    try {
        const response = await fetch('http://localhost:3000/recipes');
        if (!response.ok) throw new Error('Failed to load recipes');
        
        const xmlString = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const recipes = xmlDoc.getElementsByTagName("recipe");
        
        const recipesArray = Array.from(recipes).map(recipe => {
            const ingredients = Array.from(recipe.getElementsByTagName("ingredient"))
                .map(ing => ing.textContent);
            
            return {
                name: recipe.getElementsByTagName("name")[0].textContent,
                image: recipe.getElementsByTagName("image")[0].textContent,
                ingredients: ingredients,
                description: recipe.getElementsByTagName("instructions")[0].textContent,
                author: recipe.getElementsByTagName("author")[0]?.textContent || "Unknown",
                authorEmail: recipe.getElementsByTagName("authorEmail")[0]?.textContent || "",
                date: recipe.getElementsByTagName("date")[0]?.textContent || new Date().toISOString()
            };
        });
        
        localStorage.setItem(RECIPE_DB, JSON.stringify(recipesArray));
        return recipesArray;
    } catch (error) {
        console.error("Error loading recipes from server:", error);
        return JSON.parse(localStorage.getItem(RECIPE_DB)) || [];
    }
}

// WebSocket setup for real-time updates
function setupWebSocket() {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onmessage = (event) => {
        if (event.data === 'UPDATE_RECIPES') {
            loadRecipesFromServer().then(() => {
                initializeRecipeCards();
                loadCommunityRecipes();
                loadUploadedRecipes();
            });
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Main initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication or create default user
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    if (!currentUser) {
        const defaultUser = {
            name: "Guest User",
            email: "guest@example.com",
            avatar: "default-avatar.png",
            recipes: [],
            blogs: []
        };
        sessionStorage.setItem('currentUser', JSON.stringify(defaultUser));
        
        // Add to user database if not exists
        const users = JSON.parse(localStorage.getItem(USER_DB));
        if (!users.some(u => u.email === defaultUser.email)) {
            users.push(defaultUser);
            localStorage.setItem(USER_DB, JSON.stringify(users));
        }
    }
    
    // Initialize all components
    initializeThemeToggle();
    initializeAccountSidebar();
    initializeRecipeCards();
    initializeBlogForm();
    initializeUploadForm();
    initializeDishForm();
    initializeSlideshow();
    initializeProfilePage();
    
    // Load content
    await loadRecipesFromServer();
    loadCommunityRecipes();
    loadCommunityBlogs();
    loadUserContent();
    loadBlogPosts();
    loadUploadedRecipes();
    loadUploadedBlogs();
    
    // Setup WebSocket connection
    setupWebSocket();
    
    // Setup logout button
    document.getElementById('logout-btn')?.addEventListener('click', function() {
        sessionStorage.removeItem('currentUser');
        window.location.href = "login.html";
    });
});

// Profile Page Initialization
function initializeProfilePage() {
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');
    
    if (avatarUpload && avatarPreview) {
        avatarUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    avatarPreview.src = e.target.result;
                    // Update user data in both session and local storage
                    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
                    if (currentUser) {
                        currentUser.avatar = e.target.result;
                        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
                        
                        // Update in user database
                        const users = JSON.parse(localStorage.getItem(USER_DB));
                        const userIndex = users.findIndex(u => u.email === currentUser.email);
                        if (userIndex !== -1) {
                            users[userIndex].avatar = e.target.result;
                            localStorage.setItem(USER_DB, JSON.stringify(users));
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Profile Editing
    const saveProfileBtn = document.querySelector('.save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            const username = document.getElementById('username-input').value;
            const email = document.getElementById('email-input').value;
            
            if (!username || !email) {
                alert('Please fill in all fields');
                return;
            }
            
            updateUserData('name', username);
            updateUserData('email', email);
            alert('Profile updated successfully!');
        });
    }
    
    // Tab Switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId)?.classList.add('active');
        });
    });
    
    // Social Links Saving
    const saveSocialsBtn = document.querySelector('.save-socials-btn');
    if (saveSocialsBtn) {
        saveSocialsBtn.addEventListener('click', function() {
            const twitter = document.getElementById('twitter-input').value;
            const instagram = document.getElementById('instagram-input').value;
            
            updateUserData('socials', {
                twitter: twitter || '',
                instagram: instagram || ''
            });
            
            alert('Social links saved successfully!');
        });
    }
}

// Helper function to update user data in both session and local storage
function updateUserData(key, value) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) return;
    
    currentUser[key] = value;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update in user database
    const users = JSON.parse(localStorage.getItem(USER_DB));
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    if (userIndex !== -1) {
        users[userIndex][key] = value;
        localStorage.setItem(USER_DB, JSON.stringify(users));
    }
}

// Load user-specific content
function loadUserContent() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) return;
    
    // Load profile data
    if (document.getElementById('username-input')) {
        document.getElementById('username-input').value = currentUser.name || '';
    }
    if (document.getElementById('email-input')) {
        document.getElementById('email-input').value = currentUser.email || '';
    }
    if (document.getElementById('avatar-preview')) {
        document.getElementById('avatar-preview').src = currentUser.avatar || 'default-avatar.png';
    }
    
    // Load socials if they exist
    if (currentUser.socials) {
        if (document.getElementById('twitter-input')) {
            document.getElementById('twitter-input').value = currentUser.socials.twitter || '';
        }
        if (document.getElementById('instagram-input')) {
            document.getElementById('instagram-input').value = currentUser.socials.instagram || '';
        }
    }
    
    // Load user recipes and blogs
    loadUserRecipes();
    loadUserBlogs();
}

// Load all blog posts in the main blog section
function loadBlogPosts() {
    const blogs = JSON.parse(localStorage.getItem(BLOG_DB));
    const container = document.getElementById('blog-posts');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (blogs.length === 0) {
        container.innerHTML = '<p>No blog posts yet. Be the first to share!</p>';
        return;
    }
    
    blogs.forEach(blog => {
        const blogElement = document.createElement('div');
        blogElement.className = 'blog-card';
        blogElement.innerHTML = `
            <img src="${blog.image}" alt="${blog.title}">
            <div class="blog-content">
                <h3>${blog.title}</h3>
                <p>${blog.content.substring(0, 150)}...</p>
                <div class="blog-meta">
                    <span>By ${blog.author}</span>
                    <span>${new Date(blog.date).toLocaleDateString()}</span>
                </div>
                <button class="view-blog-btn">Read More</button>
            </div>
        `;
        container.appendChild(blogElement);
        
        blogElement.querySelector('.view-blog-btn').addEventListener('click', () => {
            viewFullBlog(blog);
        });
    });
}

// Load uploaded recipes in the upload section
function loadUploadedRecipes() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) return;
    
    const container = document.getElementById('uploaded-recipe');
    if (!container) return;
    
    container.innerHTML = '';
    
    const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
    const userRecipes = recipes.filter(recipe => recipe.authorEmail === currentUser.email);
    
    if (userRecipes.length === 0) {
        container.innerHTML = '<p>No recipes uploaded yet.</p>';
        return;
    }
    
    userRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.innerHTML = `
            <div class="card-front">
                <img src="${recipe.image}" alt="${recipe.name}">
                <div class="card-title">${recipe.name}</div>
            </div>
            <div class="card-back">
                <h3>${recipe.name}</h3>
                <p><strong>Ingredients:</strong> ${recipe.ingredients.join(', ')}</p>
                <p><strong>Instructions:</strong><br>${recipe.description}</p>
            </div>
        `;
        container.appendChild(card);
        
        card.addEventListener('click', function(e) {
            if (e.detail > 1) return;
            this.classList.toggle('flipped');
        });
        
        card.addEventListener('dblclick', function() {
            viewFullRecipe(recipe);
        });
    });
}

// Load uploaded blogs in the blogs section
function loadUploadedBlogs() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) return;
    
    const container = document.querySelector('.user-blogs .blog-posts-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const blogs = JSON.parse(localStorage.getItem(BLOG_DB));
    const userBlogs = blogs.filter(blog => blog.authorEmail === currentUser.email);
    
    if (userBlogs.length === 0) {
        container.innerHTML = '<p>No blogs published yet.</p>';
        return;
    }
    
    userBlogs.forEach(blog => {
        const blogElement = document.createElement('div');
        blogElement.className = 'my-blog-card';
        blogElement.innerHTML = `
            <img src="${blog.image}" alt="${blog.title}">
            <div class="my-blog-content">
                <h5>${blog.title}</h5>
                <p>${new Date(blog.date).toLocaleDateString()}</p>
                <div class="action-buttons">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                    <button class="view-btn">View</button>
                </div>
            </div>
        `;
        container.appendChild(blogElement);
        
        blogElement.querySelector('.view-btn').addEventListener('click', () => {
            viewFullBlog(blog);
        });
        
        blogElement.querySelector('.edit-btn').addEventListener('click', () => {
            editBlog(blog);
        });
        
        blogElement.querySelector('.delete-btn').addEventListener('click', () => {
            deleteBlog(blog);
        });
    });
}

function loadUserRecipes() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) return;
    
    const container = document.querySelector('.uploaded-recipes-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!currentUser.recipes || currentUser.recipes.length === 0) {
        container.innerHTML = '<p>You haven\'t uploaded any recipes yet.</p>';
        return;
    }
    
    const allRecipes = JSON.parse(localStorage.getItem(RECIPE_DB));
    
    currentUser.recipes.forEach(recipeRef => {
        const recipe = allRecipes.find(r => r.name === recipeRef.name && r.authorEmail === currentUser.email);
        if (recipe) {
            const recipeElement = document.createElement('div');
            recipeElement.className = 'my-recipe-card';
            recipeElement.innerHTML = `
                <img src="${recipe.image}" alt="${recipe.name}">
                <div class="my-recipe-content">
                    <h5>${recipe.name}</h5>
                    <p>${new Date(recipe.date).toLocaleDateString()}</p>
                    <div class="action-buttons">
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </div>
            `;
            container.appendChild(recipeElement);
            
            // Add event listeners
            recipeElement.querySelector('.edit-btn').addEventListener('click', () => editRecipe(recipe));
            recipeElement.querySelector('.delete-btn').addEventListener('click', () => deleteRecipe(recipe));
        }
    });
}

function loadUserBlogs() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) return;
    
    const container = document.querySelector('.blog-posts-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!currentUser.blogs || currentUser.blogs.length === 0) {
        container.innerHTML = '<p>You haven\'t published any blogs yet.</p>';
        return;
    }
    
    const allBlogs = JSON.parse(localStorage.getItem(BLOG_DB));
    
    currentUser.blogs.forEach(blogRef => {
        const blog = allBlogs.find(b => b.title === blogRef.title && b.authorEmail === currentUser.email);
        if (blog) {
            const blogElement = document.createElement('div');
            blogElement.className = 'my-blog-card';
            blogElement.innerHTML = `
                <img src="${blog.image}" alt="${blog.title}">
                <div class="my-blog-content">
                    <h5>${blog.title}</h5>
                    <p>${new Date(blog.date).toLocaleDateString()}</p>
                    <div class="action-buttons">
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </div>
            `;
            container.appendChild(blogElement);
            
            // Add event listeners
            blogElement.querySelector('.edit-btn').addEventListener('click', () => editBlog(blog));
            blogElement.querySelector('.delete-btn').addEventListener('click', () => deleteBlog(blog));
        }
    });
}

// View full blog post
function viewFullBlog(blog) {
    const blogWindow = window.open('', '_blank');
    blogWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${blog.title}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 2rem; 
                    background: #f5f5f5;
                }
                .blog-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 2rem;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                h1 { color: #3AAFA9; }
                img { 
                    max-width: 100%; 
                    height: auto;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }
                .blog-content {
                    line-height: 1.6;
                }
                .blog-content p {
                    margin-bottom: 1rem;
                }
                .blog-meta {
                    color: #666;
                    margin-bottom: 1rem;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="blog-container">
                <h1>${blog.title}</h1>
                <div class="blog-meta">Posted by ${blog.author} on ${new Date(blog.date).toLocaleDateString()}</div>
                <img src="${blog.image}" alt="${blog.title}">
                <div class="blog-content">
                    ${blog.content.replace(/\n/g, '<br>')}
                </div>
                ${blog.contentImage ? `<img src="${blog.contentImage}" alt="Blog content image" style="margin-top: 2rem;">` : ''}
            </div>
        </body>
        </html>
    `);
    blogWindow.document.close();
}

// Recipe and Blog CRUD operations
function editRecipe(recipe) {
    // Implementation for editing a recipe
    alert(`Editing recipe: ${recipe.name}`);
}

function deleteRecipe(recipe) {
    if (confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
        
        // Remove from recipes database
        const updatedRecipes = recipes.filter(r => !(r.name === recipe.name && r.authorEmail === currentUser.email));
        localStorage.setItem(RECIPE_DB, JSON.stringify(updatedRecipes));
        
        // Remove from user's recipes
        currentUser.recipes = currentUser.recipes.filter(r => r.name !== recipe.name);
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Update in user database
        const users = JSON.parse(localStorage.getItem(USER_DB));
        const userIndex = users.findIndex(u => u.email === currentUser.email);
        if (userIndex !== -1) {
            users[userIndex].recipes = currentUser.recipes;
            localStorage.setItem(USER_DB, JSON.stringify(users));
        }
        
        loadUserRecipes();
        loadCommunityRecipes();
        loadUploadedRecipes();
        alert('Recipe deleted successfully!');
    }
}

function editBlog(blog) {
    // Implementation for editing a blog
    alert(`Editing blog: ${blog.title}`);
}

function deleteBlog(blog) {
    if (confirm(`Are you sure you want to delete "${blog.title}"?`)) {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        const blogs = JSON.parse(localStorage.getItem(BLOG_DB));
        
        // Remove from blogs database
        const updatedBlogs = blogs.filter(b => !(b.title === blog.title && b.authorEmail === currentUser.email));
        localStorage.setItem(BLOG_DB, JSON.stringify(updatedBlogs));
        
        // Remove from user's blogs
        currentUser.blogs = currentUser.blogs.filter(b => b.title !== blog.title);
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Update in user database
        const users = JSON.parse(localStorage.getItem(USER_DB));
        const userIndex = users.findIndex(u => u.email === currentUser.email);
        if (userIndex !== -1) {
            users[userIndex].blogs = currentUser.blogs;
            localStorage.setItem(USER_DB, JSON.stringify(users));
        }
        
        loadUserBlogs();
        loadCommunityBlogs();
        loadBlogPosts();
        loadUploadedBlogs();
        alert('Blog deleted successfully!');
    }
}

// Community content loading
function loadCommunityRecipes() {
    const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
    const container = document.querySelector('.community-recipes');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (recipes.length === 0) {
        container.innerHTML = '<p>No community recipes yet. Be the first to share!</p>';
        return;
    }
    
    recipes.forEach(recipe => {
        const recipeElement = document.createElement('div');
        recipeElement.className = 'community-item';
        recipeElement.innerHTML = `
            <div class="item-header">
                <img src="${recipe.image || 'logo.png'}" alt="Recipe" class="item-logo">
                <span class="item-author">${recipe.author}</span>
            </div>
            <h5 class="item-title">${recipe.name}</h5>
            <a href="#recipes" class="view-item">View Recipe</a>
        `;
        container.appendChild(recipeElement);
        
        recipeElement.querySelector('.view-item').addEventListener('click', function() {
            highlightRecipeInSection(recipe.name);
        });
    });
}

function loadCommunityBlogs() {
    const blogs = JSON.parse(localStorage.getItem(BLOG_DB));
    const container = document.querySelector('.community-blogs');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (blogs.length === 0) {
        container.innerHTML = '<p>No community blogs yet. Be the first to share!</p>';
        return;
    }
    
    blogs.forEach(blog => {
        const blogElement = document.createElement('div');
        blogElement.className = 'community-item';
        blogElement.innerHTML = `
            <div class="item-header">
                <img src="${blog.authorAvatar || 'logo.png'}" alt="Blog Author" class="item-logo">
                <span class="item-author">${blog.author}</span>
            </div>
            <h5 class="item-title">${blog.title}</h5>
            <a href="#blogs" class="view-item">Read Blog</a>
        `;
        container.appendChild(blogElement);
        
        blogElement.querySelector('.view-item').addEventListener('click', function() {
            highlightBlogInSection(blog.title);
        });
    });
}

function highlightRecipeInSection(recipeName) {
    const recipeCards = document.querySelectorAll('.recipe-card');
    recipeCards.forEach(card => {
        const cardTitle = card.querySelector('.card-title').textContent;
        if (cardTitle === recipeName) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('highlighted');
            setTimeout(() => card.classList.remove('highlighted'), 2000);
        }
    });
}

function highlightBlogInSection(blogTitle) {
    const blogCards = document.querySelectorAll('.blog-card');
    blogCards.forEach(card => {
        const cardTitle = card.querySelector('h3').textContent;
        if (cardTitle === blogTitle) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('highlighted');
            setTimeout(() => card.classList.remove('highlighted'), 2000);
        }
    });
}

// Theme toggle functionality
function initializeThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    const body = document.body;
    const currentTheme = localStorage.getItem('theme') || 
                        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    // Set initial theme
    if (currentTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    } else {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
    }
    
    themeToggle.addEventListener('click', () => {
        if (body.getAttribute('data-theme') === 'dark') {
            body.removeAttribute('data-theme');
            themeToggle.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        } else {
            body.setAttribute('data-theme', 'dark');
            themeToggle.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        }
    });
}

// Account sidebar functionality
function initializeAccountSidebar() {
    const accountBtn = document.getElementById('account-btn');
    const accountSidebar = document.getElementById('account-sidebar');
    const closeSidebar = document.querySelector('.close-sidebar');
    let overlay = document.getElementById('overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.id = 'overlay';
        document.body.appendChild(overlay);
    }
    
    function toggleSidebar() {
        accountSidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        
        if (accountSidebar.classList.contains('active')) {
            loadUserContent();
        }
    }
    
    if (accountBtn) accountBtn.addEventListener('click', toggleSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);
}

// Recipe card functionality
function initializeRecipeCards() {
    const recipeCards = document.querySelectorAll('.recipe-card');
    
    recipeCards.forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.detail > 1) return;
            
            recipeCards.forEach(otherCard => {
                if (otherCard !== this && otherCard.classList.contains('flipped')) {
                    otherCard.classList.remove('flipped');
                }
            });
            
            this.classList.toggle('flipped');
        });
        
        card.addEventListener('dblclick', function() {
            const recipeName = this.querySelector('.card-title').textContent;
            const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
            const recipe = recipes.find(r => r.name === recipeName);
            if (recipe) viewFullRecipe(recipe);
        });
    });
}

// Blog form functionality
function initializeBlogForm() {
    const blogForm = document.getElementById('blog-form');
    if (!blogForm) return;
    
    blogForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('Please login to post blogs');
            return;
        }
        
        const title = document.getElementById('blog-title').value;
        const content = document.getElementById('blog-content').value;
        const imageFile = document.getElementById('blog-image').files[0];
        const contentImageFile = document.getElementById('blog-content-image').files[0];
        
        if (!title || !content || !imageFile) {
            alert('Please fill in all required fields');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const blogImage = e.target.result;
            
            let contentImage = null;
            if (contentImageFile) {
                const contentReader = new FileReader();
                contentReader.onload = function(e) {
                    contentImage = e.target.result;
                    saveBlog(title, content, blogImage, contentImage, currentUser);
                    loadBlogPosts();
                    loadUploadedBlogs();
                };
                contentReader.readAsDataURL(contentImageFile);
            } else {
                saveBlog(title, content, blogImage, null, currentUser);
                loadBlogPosts();
                loadUploadedBlogs();
            }
        };
        reader.readAsDataURL(imageFile);
    });
}

function saveBlog(title, content, image, contentImage, author) {
    const blogs = JSON.parse(localStorage.getItem(BLOG_DB));
    
    const newBlog = {
        title,
        content,
        image,
        contentImage,
        author: author.name,
        authorEmail: author.email,
        authorAvatar: author.avatar || 'default-avatar.png',
        date: new Date().toISOString(),
        likes: 0,
        comments: []
    };
    
    blogs.push(newBlog);
    localStorage.setItem(BLOG_DB, JSON.stringify(blogs));
    
    // Add to user's blogs
    if (!author.blogs) author.blogs = [];
    author.blogs.push({
        title,
        date: new Date().toISOString()
    });
    
    sessionStorage.setItem('currentUser', JSON.stringify(author));
    
    // Update in user database
    const users = JSON.parse(localStorage.getItem(USER_DB));
    const userIndex = users.findIndex(u => u.email === author.email);
    if (userIndex !== -1) {
        if (!users[userIndex].blogs) users[userIndex].blogs = [];
        users[userIndex].blogs.push({
            title,
            date: new Date().toISOString()
        });
        localStorage.setItem(USER_DB, JSON.stringify(users));
    }
    
    alert('Blog published successfully!');
    document.getElementById('blog-form').reset();
}

// Upload recipe functionality
function initializeUploadForm() {
    const uploadForm = document.getElementById('upload-form');
    if (!uploadForm) return;
    
    const addIngredientBtn = document.getElementById('add-ingredient');
    const ingredientInput = document.getElementById('ingredient-input');
    const ingredientsList = document.getElementById('ingredients-list');
    
    if (addIngredientBtn && ingredientInput && ingredientsList) {
        addIngredientBtn.addEventListener('click', function() {
            const ingredients = ingredientInput.value.split(',').map(i => i.trim()).filter(i => i);
            if (ingredients.length > 0) {
                currentIngredients.push(...ingredients);
                updateIngredientsList();
                ingredientInput.value = '';
            }
        });
        
        ingredientInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addIngredientBtn.click();
            }
        });
    }
    
    function updateIngredientsList() {
        ingredientsList.innerHTML = currentIngredients.map((ing, index) => `
            <div class="ingredient-tag">
                ${ing}
                <button class="remove-ingredient" data-index="${index}">×</button>
            </div>
        `).join('');
        
        document.querySelectorAll('.remove-ingredient').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                currentIngredients.splice(index, 1);
                updateIngredientsList();
            });
        });
    }
    
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('Please login to upload recipes');
            return;
        }
        
        const recipeName = document.getElementById('recipe-name').value;
        const recipeDescription = document.getElementById('recipe-description').value;
        
        if (!recipeName || !recipeDescription || currentIngredients.length === 0) {
            alert('Please fill in all fields and add at least one ingredient');
            return;
        }
        
        const imageInput = document.getElementById('recipe-image');
        if (imageInput.files && imageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                saveRecipe(recipeName, recipeDescription, currentIngredients, e.target.result, currentUser);
                loadUploadedRecipes();
            };
            reader.readAsDataURL(imageInput.files[0]);
        } else {
            saveRecipe(recipeName, recipeDescription, currentIngredients, 'logo.png', currentUser);
            loadUploadedRecipes();
        }
    });
}

function saveRecipe(name, description, ingredients, imageUrl, author) {
    const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
    
    const newRecipe = {
        name,
        description,
        ingredients,
        image: imageUrl,
        author: author.name,
        authorEmail: author.email,
        date: new Date().toISOString()
    };
    
    recipes.push(newRecipe);
    localStorage.setItem(RECIPE_DB, JSON.stringify(recipes));
    
    // Add to user's recipes
    if (!author.recipes) author.recipes = [];
    author.recipes.push({
        name,
        date: new Date().toISOString()
    });
    
    sessionStorage.setItem('currentUser', JSON.stringify(author));
    
    // Update in user database
    const users = JSON.parse(localStorage.getItem(USER_DB));
    const userIndex = users.findIndex(u => u.email === author.email);
    if (userIndex !== -1) {
        if (!users[userIndex].recipes) users[userIndex].recipes = [];
        users[userIndex].recipes.push({
            name,
            date: new Date().toISOString()
        });
        localStorage.setItem(USER_DB, JSON.stringify(users));
    }
    
    alert('Recipe uploaded successfully!');
    document.getElementById('upload-form').reset();
    document.getElementById('ingredients-list').innerHTML = '';
    currentIngredients = [];
    loadCommunityRecipes();
    loadUserRecipes();
}

// Make a Dish functionality
function initializeDishForm() {
    const dishForm = document.getElementById('dish-form');
    const dishResults = document.getElementById('dish-results');
    if (!dishForm || !dishResults) return;
    
    dishForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const ingredients = document.getElementById('ingredients').value.toLowerCase().split(',').map(i => i.trim());
        dishResults.innerHTML = '';

        if (!ingredients || ingredients.length === 0 || (ingredients.length === 1 && ingredients[0] === '')) {
            dishResults.innerHTML = '<p style="text-align: center; width: 100%; padding: 2rem;">Please enter some ingredients to search</p>';
            return;
        }

        const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
        
        const matchingRecipes = recipes.filter(recipe => {
            return ingredients.some(inputIng => 
                recipe.ingredients.some(ing => 
                    ing.toLowerCase().includes(inputIng)
            ));
        });

        if (matchingRecipes.length === 0) {
            dishResults.innerHTML = '<p style="text-align: center; width: 100%; padding: 2rem;">No recipes found with those ingredients. Try different ones!</p>';
            return;
        }

        matchingRecipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
                <div class="card-front">
                    <img src="${recipe.image}" alt="${recipe.name}">
                    <div class="card-title">${recipe.name}</div>
                </div>
                <div class="card-back">
                    <h3>${recipe.name}</h3>
                    <p><strong>Ingredients:</strong> ${recipe.ingredients.join(', ')}</p>
                    <p><strong>Instructions:</strong><br>${recipe.description}</p>
                </div>
            `;
            dishResults.appendChild(card);
            
            card.addEventListener('click', function(e) {
                if (e.detail > 1) return;
                this.classList.toggle('flipped');
            });
            
            card.addEventListener('dblclick', function() {
                viewFullRecipe(recipe);
            });
        });
    });
}

// Slideshow functionality
function initializeSlideshow() {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;
    
    let currentSlide = 0;
    
    function showSlide() {
        slides.forEach(s => s.classList.remove('active'));
        slides[currentSlide].classList.add('active');
        currentSlide = (currentSlide + 1) % slides.length;
    }
    
    setInterval(showSlide, 5000);
    showSlide();
}

// View full recipe in new window with similar recipes
function viewFullRecipe(recipe) {
    const recipes = JSON.parse(localStorage.getItem(RECIPE_DB));
    
    // Find similar recipes (by shared ingredients)
    const similarRecipes = recipes.filter(r => {
        return r.name !== recipe.name && 
               r.ingredients.some(ing => 
                   recipe.ingredients.some(ri => 
                       ri.toLowerCase().includes(ing.toLowerCase()) ||
                       ing.toLowerCase().includes(ri.toLowerCase())
                   )
               );
    }).slice(0, 3); // Show max 3 similar recipes

    const recipeWindow = window.open('', '_blank');
    recipeWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${recipe.name} Recipe</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 2rem; 
                    background: #f5f5f5;
                }
                .recipe-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 2rem;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                h1, h2, h3 { color: #3AAFA9; }
                img { 
                    max-width: 100%; 
                    height: auto;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }
                .recipe-content {
                    line-height: 1.6;
                }
                .recipe-content p {
                    margin-bottom: 1rem;
                }
                .recipe-meta {
                    color: #666;
                    margin-bottom: 1rem;
                    font-style: italic;
                }
                .ingredients-list {
                    margin: 1rem 0;
                    padding-left: 1.5rem;
                }
                .similar-recipes {
                    margin-top: 3rem;
                    padding-top: 2rem;
                    border-top: 1px solid #eee;
                }
                .similar-recipe {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    padding: 1rem;
                    background: #f9f9f9;
                    border-radius: 8px;
                }
                .similar-recipe img {
                    width: 100px;
                    height: 100px;
                    object-fit: cover;
                }
                .similar-recipe h4 {
                    margin: 0 0 0.5rem 0;
                }
                .similar-recipe p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="recipe-container">
                <h1>${recipe.name}</h1>
                <div class="recipe-meta">Posted by ${recipe.author} on ${new Date(recipe.date).toLocaleDateString()}</div>
                <img src="${recipe.image}" alt="${recipe.name}">
                <div class="recipe-content">
                    <h3>Ingredients</h3>
                    <ul class="ingredients-list">
                        ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                    </ul>
                    <h3>Instructions</h3>
                    <p>${recipe.description}</p>
                </div>

                ${similarRecipes.length > 0 ? `
                <div class="similar-recipes">
                    <h2>Similar Recipes</h2>
                    ${similarRecipes.map(r => `
                        <div class="similar-recipe">
                            <img src="${r.image}" alt="${r.name}">
                            <div>
                                <h4>${r.name}</h4>
                                <p>${r.ingredients.slice(0, 3).join(', ')}${r.ingredients.length > 3 ? '...' : ''}</p>
                                <button onclick="window.opener.viewFullRecipeFromPopup(${JSON.stringify(r).replace(/"/g, '&quot;')})">View Recipe</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            <script>
                function viewFullRecipeFromPopup(recipe) {
                    window.opener.viewFullRecipe(recipe);
                    window.close();
                }
            </script>
        </body>
        </html>
    `);
    recipeWindow.document.close();
}

// Handle broken images gracefully
document.querySelectorAll('img').forEach(img => {
    img.onerror = function() {
        this.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = 'image-fallback';
        fallback.textContent = 'Image not available';
        this.parentNode.insertBefore(fallback, this);
    };
});