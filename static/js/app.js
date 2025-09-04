// Global variables
let currentImageIndex = 0;
let currentPageImages = [];
let allImages = [];
let currentPage = 1;
let totalPages = 1;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading indicator initially
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    
    // Initialize current page images from the gallery
    initializeCurrentPageImages();
    
    // Initialize pagination variables from the server-rendered data
    initializePaginationFromServer();
    
    // Add click event listeners to view buttons on initial page load
    addViewButtonListeners();
    
    // Add keyboard event listeners for modal navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Add click event listener to modal background for closing
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Add window resize handler for responsive modal
    window.addEventListener('resize', handleWindowResize);
    
    // Add touch events for mobile
    addTouchSupport();
});

// Initialize current page images from the gallery
function initializeCurrentPageImages() {
    const imageCards = document.querySelectorAll('.image-card');
    currentPageImages = Array.from(imageCards).map(card => ({
        name: card.dataset.imageName,
        url: card.dataset.imageUrl
    }));
}

// Initialize pagination variables from server-rendered data
function initializePaginationFromServer() {
    // Get pagination info from the server-rendered HTML
    const currentPageSpan = document.getElementById('current-page');
    
    if (currentPageSpan) {
        // Extract current page and total pages from the span text (e.g., "Page 1 of 25")
        const pageText = currentPageSpan.textContent;
        const pageMatch = pageText.match(/Page (\d+) of (\d+)/);
        
        if (pageMatch) {
            currentPage = parseInt(pageMatch[1]);
            totalPages = parseInt(pageMatch[2]);
            console.log(`Initialized pagination: currentPage=${currentPage}, totalPages=${totalPages}`);
        }
    }
}

// Add click event listeners to view buttons
function addViewButtonListeners() {
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const imageName = this.getAttribute('data-image-name');
            const imageUrl = this.getAttribute('data-image-url');
            openModal(imageName, imageUrl);
        });
    });
}

// Change page function
function changePage(page) {
    console.log(`changePage called with page=${page}, totalPages=${totalPages}`);
    
    if (page < 1 || page > totalPages) {
        console.log(`Invalid page: ${page}, valid range is 1-${totalPages}`);
        return;
    }
    
    // Show loading
    showLoading();
    
    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    
    // Fetch new page data
    fetch(`/api/images?page=${page}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);
            updateGallery(data);
            currentPage = page;
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading page:', error);
            hideLoading();
            // Fallback to page reload
            window.location.href = `/?page=${page}`;
        });
}

// Update gallery with new data
function updateGallery(data) {
    const gallery = document.getElementById('gallery');
    const pagination = document.querySelector('.pagination');
    
    // Update current page images
    currentPageImages = data.images;
    allImages = data.images;
    totalPages = data.pagination.total_pages;
    
    // Update gallery HTML
    gallery.innerHTML = data.images.map(image => `
        <div class="image-card" data-image-name="${image.name}" data-image-url="${image.url}">
            <div class="image-container">
                ${image.thumbnail ? 
                    `<img src="${image.thumbnail}" alt="${image.name}" class="gallery-image" loading="lazy">` :
                    `<div class="image-placeholder">
                        <i class="fas fa-image"></i>
                        <span>${image.name}</span>
                    </div>`
                }
                <div class="image-overlay">
                    <button class="view-btn" data-image-name="${image.name}" data-image-url="${image.url}">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
            </div>
            <div class="image-info">
                <span class="image-name">${image.name}</span>
            </div>
        </div>
    `).join('');
    
    // Add click event listeners to view buttons
    addViewButtonListeners();
    
    // Update pagination
    updatePagination(data.pagination);
    
    // Update stats
    updateStats(data.pagination);
}

// Update pagination controls
function updatePagination(pagination) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer) return;
    
    let paginationHTML = '';
    
    // Previous button
    if (pagination.has_prev) {
        paginationHTML += `
            <button class="page-btn" onclick="changePage(${pagination.current_page - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
    }
    
    // Page numbers
    paginationHTML += '<div class="page-numbers">';
    for (let pageNum = 1; pageNum <= pagination.total_pages; pageNum++) {
        if (pageNum === pagination.current_page) {
            paginationHTML += `<span class="page-number active">${pageNum}</span>`;
        } else if (pageNum <= 3 || pageNum > pagination.total_pages - 3 || 
                   (pageNum >= pagination.current_page - 1 && pageNum <= pagination.current_page + 1)) {
            paginationHTML += `<button class="page-number" onclick="changePage(${pageNum})">${pageNum}</button>`;
        } else if (pageNum === 4 && pagination.current_page > 6) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        } else if (pageNum === pagination.total_pages - 3 && pagination.current_page < pagination.total_pages - 5) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        }
    }
    paginationHTML += '</div>';
    
    // Next button
    if (pagination.has_next) {
        paginationHTML += `
            <button class="page-btn" onclick="changePage(${pagination.current_page + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
}

// Update stats display
function updateStats(pagination) {
    const totalImages = document.getElementById('total-images');
    const currentPageSpan = document.getElementById('current-page');
    
    if (totalImages) {
        totalImages.textContent = `${pagination.total_images} images`;
    }
    if (currentPageSpan) {
        currentPageSpan.textContent = `Page ${pagination.current_page} of ${pagination.total_pages}`;
    }
}

// Show loading indicator
function showLoading() {
    const loading = document.getElementById('loading');
    const gallery = document.getElementById('gallery');
    
    if (loading) {
        loading.style.display = 'flex';
    }
    if (gallery) {
        gallery.style.opacity = '0.5';
    }
}

// Hide loading indicator
function hideLoading() {
    const loading = document.getElementById('loading');
    const gallery = document.getElementById('gallery');
    
    if (loading) {
        loading.style.display = 'none';
    }
    if (gallery) {
        gallery.style.opacity = '1';
    }
}

// Open modal with image
function openModal(imageName, imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const imageNameSpan = document.getElementById('imageName');
    const imageCounterSpan = document.getElementById('imageCounter');
    const imageLoading = document.getElementById('imageLoading');
    
    // Find current image index
    currentImageIndex = currentPageImages.findIndex(img => img.name === imageName);
    
    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Show loading
    imageLoading.style.display = 'flex';
    modalImage.style.display = 'none';
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Load image
    loadModalImage(imageUrl, imageName);
    
    // Update image details
    imageNameSpan.textContent = imageName;
    imageCounterSpan.textContent = `${currentImageIndex + 1} of ${currentPageImages.length}`;
    
    // Preload adjacent images
    preloadAdjacentImages();
}

// Load image in modal
function loadModalImage(imageUrl, imageName) {
    const modalImage = document.getElementById('modalImage');
    const imageLoading = document.getElementById('imageLoading');
    
    // Create a new image object to handle loading
    const img = new Image();
    
    img.onload = function() {
        modalImage.src = imageUrl;
        modalImage.alt = imageName;
        modalImage.style.display = 'block';
        imageLoading.style.display = 'none';
        
        // Ensure image fits within viewport
        ensureImageFits();
    };
    
    img.onerror = function() {
        // Handle error - show placeholder or error message
        imageLoading.innerHTML = `
            <div>
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #e53e3e; margin-bottom: 10px;"></i>
                <p>Failed to load image</p>
            </div>
        `;
    };
    
    // Start loading the image
    img.src = imageUrl;
}

// Ensure image fits within viewport
function ensureImageFits() {
    const modalImage = document.getElementById('modalImage');
    const imageDisplay = document.querySelector('.image-display');
    
    if (!modalImage || !imageDisplay) return;
    
    // Reset any previous transformations
    modalImage.style.transform = 'scale(1)';
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get modal content dimensions
    const modalContent = document.querySelector('.modal-content');
    const modalRect = modalContent.getBoundingClientRect();
    
    // Calculate available space for image
    const availableWidth = modalRect.width - 40; // Account for padding
    const availableHeight = modalRect.height - 200; // Account for header, navigation, and details
    
    // Get image dimensions
    const imgRect = modalImage.getBoundingClientRect();
    
    // Calculate scale to fit image within available space
    const scaleX = availableWidth / imgRect.width;
    const scaleY = availableHeight / imgRect.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
    
    if (scale < 1) {
        modalImage.style.transform = `scale(${scale})`;
    }
}

// Handle window resize
function handleWindowResize() {
    const modal = document.getElementById('imageModal');
    if (modal && modal.style.display === 'block') {
        ensureImageFits();
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Navigate to previous/next image
function navigateImage(direction) {
    const newIndex = currentImageIndex + direction;
    
    if (newIndex >= 0 && newIndex < currentPageImages.length) {
        currentImageIndex = newIndex;
        const image = currentPageImages[currentImageIndex];
        
        // Update modal content
        const imageNameSpan = document.getElementById('imageName');
        const imageCounterSpan = document.getElementById('imageCounter');
        
        imageNameSpan.textContent = image.name;
        imageCounterSpan.textContent = `${currentImageIndex + 1} of ${currentPageImages.length}`;
        
        // Load new image
        loadModalImage(image.url, image.name);
        
        // Update navigation buttons
        updateNavigationButtons();
    }
}

// Update navigation buttons state
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentImageIndex <= 0;
    }
    if (nextBtn) {
        nextBtn.disabled = currentImageIndex >= currentPageImages.length - 1;
    }
}

// Handle keyboard navigation
function handleKeyboardNavigation(event) {
    const modal = document.getElementById('imageModal');
    
    if (modal.style.display === 'block') {
        switch (event.key) {
            case 'Escape':
                closeModal();
                break;
            case 'ArrowLeft':
                navigateImage(-1);
                break;
            case 'ArrowRight':
                navigateImage(1);
                break;
        }
    }
}

// Add touch support for mobile devices
function addTouchSupport() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;
    
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    
    modal.addEventListener('touchstart', function(e) {
        startX = e.changedTouches[0].screenX;
        startY = e.changedTouches[0].screenY;
    }, false);
    
    modal.addEventListener('touchend', function(e) {
        endX = e.changedTouches[0].screenX;
        endY = e.changedTouches[0].screenY;
        handleSwipe();
    }, false);
    
    function handleSwipe() {
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Minimum swipe distance
        const minSwipeDistance = 50;
        
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
            if (diffX > 0) {
                // Swipe left - next image
                navigateImage(1);
            } else {
                // Swipe right - previous image
                navigateImage(-1);
            }
        }
    }
}

// Preload next/previous images for smoother navigation
function preloadAdjacentImages() {
    const preloadIndexes = [];
    
    if (currentImageIndex > 0) {
        preloadIndexes.push(currentImageIndex - 1);
    }
    if (currentImageIndex < currentPageImages.length - 1) {
        preloadIndexes.push(currentImageIndex + 1);
    }
    
    preloadIndexes.forEach(index => {
        const image = currentPageImages[index];
        if (image && image.url) {
            const img = new Image();
            img.src = image.url;
        }
    });
}

// Add smooth scrolling for pagination
function smoothScrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Enhanced change page with smooth scroll
function changePageWithScroll(page) {
    changePage(page);
    setTimeout(smoothScrollToTop, 100);
}
