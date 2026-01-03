import React, { useState, useEffect, useRef } from 'react';
import { Heart, Share2 } from 'lucide-react';

export default function BibleScroll() {
  const [verses, setVerses] = useState([]);
  const [books, setBooks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});

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

  const handleScroll = (e) => {
    const container = e.target;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      
      // Load more verses when near the end
      if (newIndex >= verses.length - 2 && !loading) {
        loadMultipleVerses(books, 3);
      }
    }
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < verses.length - 1) {
        scrollToIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        scrollToIndex(currentIndex - 1);
      }
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

  const toggleLike = (verseId) => {
    setLiked(prev => ({...prev, [verseId]: !prev[verseId]}));
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
    ctx.fillText('Bible Verses', canvas.width / 2, canvas.height - 100);
    
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
      
      <div 
        ref={containerRef}
        style={styles.scrollContainer}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
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
                <div style={styles.iconButton} onClick={() => toggleLike(verse.id)}>
                  <Heart 
                    size={32} 
                    fill={liked[verse.id] ? '#ff4444' : 'none'}
                    color={liked[verse.id] ? '#ff4444' : 'white'}
                  />
                  <span style={styles.iconLabel}>
                    {liked[verse.id] ? 'Liked' : 'Like'}
                  </span>
                </div>
                
                <div style={styles.iconButton} onClick={() => shareVerse(verse)}>
                  <Share2 size={32} color="white" />
                  <span style={styles.iconLabel}>Share</span>
                </div>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div style={styles.progressContainer}>
              {verses.map((_, i) => (
                <div 
                  key={i} 
                  style={{
                    ...styles.progressDot,
                    ...(i === index ? styles.progressDotActive : {})
                  }}
                />
              ))}
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
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch'
  },
  verseSlide: {
    width: '100%',
    height: '100vh',
    scrollSnapAlign: 'start',
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
    userSelect: 'none'
  },
  iconLabel: {
    fontSize: '12px',
    color: 'white',
    fontWeight: '600',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)'
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
  }
};

const cssStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .iconButton:hover {
    transform: scale(1.1);
  }

  .iconButton:active {
    transform: scale(0.95);
  }

  /* Hide scrollbar */
  .scrollContainer::-webkit-scrollbar {
    display: none;
  }
  
  .scrollContainer {
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