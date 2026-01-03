import React, { useState, useEffect, useRef } from 'react';
import { Heart, Share2, X, BookMarked } from 'lucide-react';

export default function BibleScroll() {
  const [verses, setVerses] = useState([]);
  const [books, setBooks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [showLikedModal, setShowLikedModal] = useState(false);
  const [likedVerses, setLikedVerses] = useState([]);

  // Storage helper functions
  const storage = {
    async get(key) {
      try {
        if (window.storage) {
          return await window.storage.get(key);
        } else {
          const value = localStorage.getItem(key);
          return value ? { key, value } : null;
        }
      } catch (err) {
        console.error('Storage get error:', err);
        return null;
      }
    },
    async set(key, value) {
      try {
        if (window.storage) {
          return await window.storage.set(key, value);
        } else {
          localStorage.setItem(key, value);
          return { key, value };
        }
      } catch (err) {
        console.error('Storage set error:', err);
        return null;
      }
    },
    async delete(key) {
      try {
        if (window.storage) {
          return await window.storage.delete(key);
        } else {
          localStorage.removeItem(key);
          return { key, deleted: true };
        }
      } catch (err) {
        console.error('Storage delete error:', err);
        return null;
      }
    },
    async list(prefix) {
      try {
        if (window.storage) {
          return await window.storage.list(prefix);
        } else {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              keys.push(key);
            }
          }
          return { keys };
        }
      } catch (err) {
        console.error('Storage list error:', err);
        return { keys: [] };
      }
    }
  };

  // Load liked verses from storage on mount
  useEffect(() => {
    loadLikedVerses();
  }, []);

  const loadLikedVerses = async () => {
    try {
      const result = await storage.list('liked-verse:');
      if (result && result.keys) {
        const versesData = [];
        for (const key of result.keys) {
          try {
            const verseResult = await storage.get(key);
            if (verseResult && verseResult.value) {
              const verse = JSON.parse(verseResult.value);
              versesData.push(verse);
              setLiked(prev => ({...prev, [verse.id]: true}));
            }
          } catch (err) {
            console.log('Error loading verse:', err);
          }
        }
        setLikedVerses(versesData);
      }
    } catch (err) {
      console.log('No liked verses yet or error loading:', err);
    }
  };

  // Fetch books list on mount
  useEffect(() => {
    fetch('https://bible.helloao.org/api/BSB/books.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.books) {
          setBooks(data.books);
          // Load initial verses
          loadMultipleVerses(data.books, 5);
        }
      })
      .catch(err => {
        console.error('Error fetching books:', err);
      });
  }, []);

  const fetchRandomVerse = async (booksList) => {
    if (!booksList || booksList.length === 0) return null;
    
    const randomBook = booksList[Math.floor(Math.random() * booksList.length)];
    const randomChapter = Math.floor(Math.random() * randomBook.numberOfChapters) + 1;
    
    try {
      const response = await fetch(`https://bible.helloao.org/api/BSB/${randomBook.id}/${randomChapter}.json`);
      const data = await response.json();
      
      if (data.chapter && data.chapter.content && data.chapter.content.length > 0) {
        const versesOnly = data.chapter.content.filter(item => item.type === 'verse' && item.content);
        
        if (versesOnly.length > 0) {
          const randomVerseData = versesOnly[Math.floor(Math.random() * versesOnly.length)];
          
          let verseText = '';
          if (Array.isArray(randomVerseData.content)) {
            verseText = randomVerseData.content
              .map(item => {
                if (typeof item === 'string') {
                  return item;
                } else if (typeof item === 'object' && item.text) {
                  return item.text;
                }
                return '';
              })
              .join(' ')
              .trim();
          }
          
          return {
            id: `${data.book.id}-${data.chapter.number}-${randomVerseData.number}`,
            text: verseText,
            reference: `${data.book.name} ${data.chapter.number}:${randomVerseData.number}`,
            book: data.book.name,
            chapter: data.chapter.number,
            verseNumber: randomVerseData.number
          };
        }
      }
    } catch (err) {
      console.error('Error fetching verse:', err);
    }
    
    return null;
  };

  const loadMultipleVerses = async (booksList, count) => {
    setLoading(true);
    const newVerses = [];
    
    for (let i = 0; i < count; i++) {
      const verse = await fetchRandomVerse(booksList);
      if (verse) {
        newVerses.push(verse);
      }
    }
    
    setVerses(prev => [...prev, ...newVerses]);
    setLoading(false);
  };

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollTime = useRef(Date.now());

  const handleScroll = (e) => {
    const container = e.target;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    
    setIsScrolling(true);
    lastScrollTime.current = Date.now();
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      
      // Load more verses when near the end
      if (newIndex >= verses.length - 2 && !loading) {
        loadMultipleVerses(books, 3);
      }
    }

    // Snap to nearest verse after scrolling stops
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      const targetIndex = Math.round(container.scrollTop / itemHeight);
      if (Math.abs(container.scrollTop - targetIndex * itemHeight) > 5) {
        container.scrollTo({
          top: targetIndex * itemHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    if (containerRef.current) {
      containerRef.current.style.scrollSnapType = 'none';
    }
  };

  const handleTouchMove = (e) => {
    // Allow native scrolling behavior
  };

  const handleTouchEnd = (e) => {
    if (containerRef.current) {
      containerRef.current.style.scrollSnapType = 'y mandatory';
      
      // Let the scroll momentum finish, then snap
      setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          const itemHeight = container.clientHeight;
          const targetIndex = Math.round(container.scrollTop / itemHeight);
          container.scrollTo({
            top: targetIndex * itemHeight,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  };

  const scrollToIndex = (index) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * containerRef.current.clientHeight,
        behavior: 'smooth'
      });
    }
  };

  const toggleLike = async (verse) => {
    const isLiked = liked[verse.id];
    
    try {
      if (isLiked) {
        // Unlike - remove from storage
        await storage.delete(`liked-verse:${verse.id}`);
        setLiked(prev => {
          const newLiked = {...prev};
          delete newLiked[verse.id];
          return newLiked;
        });
        setLikedVerses(prev => prev.filter(v => v.id !== verse.id));
      } else {
        // Like - save to storage
        await storage.set(`liked-verse:${verse.id}`, JSON.stringify(verse));
        setLiked(prev => ({...prev, [verse.id]: true}));
        setLikedVerses(prev => [...prev, verse]);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      alert('Error saving like. Please try again.');
    }
  };

  const toggleSave = (verseId) => {
    setSaved(prev => ({...prev, [verseId]: !prev[verseId]}));
  };

  const shareVerse = async (verse) => {
    // Create a canvas to draw the verse image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 1080;
    canvas.height = 1920;
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add decorative elements
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
    ctx.beginPath();
    ctx.arc(200, 300, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(900, 1500, 500, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw quote marks
    ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
    ctx.font = 'bold 200px Georgia';
    ctx.fillText('"', 100, 300);
    
    // Draw verse text
    ctx.fillStyle = 'white';
    ctx.font = '500 48px Georgia';
    ctx.textAlign = 'center';
    
    // Word wrap the verse text
    const maxWidth = 900;
    const words = verse.text.split(' ');
    let line = '';
    let y = 700;
    const lineHeight = 70;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, canvas.width / 2, y);
        line = words[i] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, canvas.width / 2, y);
    
    // Draw reference
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('— ' + verse.reference, canvas.width / 2, y + 120);
    
    // Draw app name/watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 28px Arial';
    ctx.fillText('BibleScroll.vercel.app', canvas.width / 2, canvas.height - 100);
    
    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${verse.reference.replace(/[: ]/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div style={styles.container}>
      <style>{cssStyles}</style>
      
      {/* Floating Liked Button */}
      <button 
        style={styles.floatingButton}
        onClick={() => setShowLikedModal(true)}
        className="floating-button"
      >
        <BookMarked size={24} color="white" />
        {likedVerses.length > 0 && (
          <span style={styles.badge}>{likedVerses.length}</span>
        )}
      </button>

      {/* Liked Verses Modal */}
      {showLikedModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLikedModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <Heart size={28} fill="#ff4444" color="#ff4444" />
                Liked Verses
              </h2>
              <button 
                style={styles.closeButton}
                onClick={() => setShowLikedModal(false)}
                className="close-button"
                type="button"
                aria-label="Close"
              >
                <X size={24} color="white" strokeWidth={2} />
              </button>
            </div>
            
            <div style={styles.modalContent}>
              {likedVerses.length === 0 ? (
                <div style={styles.emptyState}>
                  <Heart size={64} color="#666" />
                  <p style={styles.emptyText}>No liked verses yet</p>
                  <p style={styles.emptySubtext}>Start liking verses to save them here</p>
                </div>
              ) : (
                <div style={styles.likedList}>
                  {likedVerses.map((verse) => (
                    <div key={verse.id} style={styles.likedCard} className="liked-card">
                      <p style={styles.likedVerseText}>{verse.text}</p>
                      <div style={styles.likedVerseFooter}>
                        <span style={styles.likedReference}>{verse.reference}</span>
                        <button
                          style={styles.unlikeButton}
                          onClick={() => {
                            toggleLike(verse);
                          }}
                          className="unlike-button"
                        >
                          <Heart size={20} fill="#ff4444" color="#ff4444" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        style={styles.scrollContainer}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {verses.map((verse, index) => (
          <div key={verse.id} style={styles.verseSlide}>
            <div style={styles.verseContent}>
              <div style={styles.textContainer}>
                <p style={styles.verseText}>{verse.text}</p>
                <p style={styles.reference}>{verse.reference}</p>
              </div>
              
              <div style={styles.sidebar}>
                <button 
                  style={styles.iconButton} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLike(verse);
                  }}
                  className="icon-button"
                  type="button"
                >
                  <Heart 
                    size={32} 
                    fill={liked[verse.id] ? '#ff4444' : 'none'}
                    color={liked[verse.id] ? '#ff4444' : 'white'}
                    style={{pointerEvents: 'none'}}
                  />
                  <span style={styles.iconLabel}>
                    {liked[verse.id] ? 'Liked' : 'Like'}
                  </span>
                </button>
                
                <button 
                  style={styles.iconButton} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    shareVerse(verse);
                  }}
                  className="icon-button"
                  type="button"
                >
                  <Share2 size={32} color="white" style={{pointerEvents: 'none'}} />
                  <span style={styles.iconLabel}>Share</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div style={styles.verseSlide}>
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Loading more verses...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: '#000'
  },
  scrollContainer: {
    width: '100%',
    height: '100%',
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    touchAction: 'pan-y'
  },
  verseSlide: {
    width: '100%',
    height: '100vh',
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: '20px'
  },
  verseContent: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  textContainer: {
    maxWidth: '600px',
    padding: '40px',
    textAlign: 'center',
    color: 'white',
    flex: 1
  },
  verseText: {
    fontSize: '28px',
    lineHeight: '1.6',
    fontWeight: '500',
    marginBottom: '30px',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
    fontFamily: "'Georgia', serif"
  },
  reference: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fbbf24',
    textShadow: '0 2px 5px rgba(0,0,0,0.5)'
  },
  sidebar: {
    position: 'absolute',
    right: '20px',
    bottom: '100px',
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
    zIndex: 10
  },
  iconButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    userSelect: 'none',
    background: 'transparent',
    border: 'none',
    padding: '10px',
    touchAction: 'manipulation'
  },
  iconLabel: {
    fontSize: '12px',
    color: 'white',
    fontWeight: '600',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
    pointerEvents: 'none'
  },
  progressContainer: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 5
  },
  progressDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.3)',
    transition: 'all 0.3s'
  },
  progressDotActive: {
    height: '20px',
    background: 'white',
    borderRadius: '2px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    color: 'white',
    fontSize: '16px'
  },
  floatingButton: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(255, 68, 68, 0.5)',
    zIndex: 1000,
    transition: 'transform 0.2s',
    touchAction: 'manipulation'
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    background: '#fbbf24',
    color: '#1a1a2e',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    border: '2px solid #1a1a2e'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px'
  },
  modal: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  modalTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'white',
    margin: 0
  },
  closeButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    minWidth: '40px',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
    padding: '0',
    flexShrink: 0
  },
  modalContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px'
  },
  emptyText: {
    color: 'white',
    fontSize: '20px',
    fontWeight: '600',
    margin: 0
  },
  emptySubtext: {
    color: '#999',
    fontSize: '14px',
    margin: 0
  },
  likedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  likedCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'transform 0.2s, background 0.2s'
  },
  likedVerseText: {
    color: 'white',
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '12px',
    fontFamily: "'Georgia', serif"
  },
  likedVerseFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  likedReference: {
    color: '#fbbf24',
    fontSize: '14px',
    fontWeight: '600'
  },
  unlikeButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s'
  }
};

const cssStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    overscroll-behavior: none;
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .icon-button:hover {
    transform: scale(1.1);
  }

  .icon-button:active {
    transform: scale(0.95);
  }

  .floating-button:hover {
    transform: scale(1.1);
  }

  .floating-button:active {
    transform: scale(0.95);
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2) !important;
  }

  .liked-card:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.08) !important;
  }

  .unlike-button:hover {
    background: rgba(255, 68, 68, 0.2) !important;
  }

  /* Hide scrollbar */
  *::-webkit-scrollbar {
    display: none;
  }
  
  * {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @media (max-width: 768px) {
    .verseText {
      font-size: 22px !important;
      padding: 20px !important;
    }
    
    .textContainer {
      padding: 20px !important;
    }
  }
`;