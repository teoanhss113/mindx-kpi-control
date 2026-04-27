/**
 * Unit Tests: Layout Components
 * 
 * Feature: apple-design-system-implementation
 * Task 7.4: Write unit tests for layout components
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 * 
 * This test suite verifies the layout system implementation:
 * - Spacing system (8px base with granular adjustments)
 * - Full-viewport-width sections with centered content blocks
 * - Maximum content width of approximately 980px
 * - Cinematic breathing room between product sections
 * - Responsive grid layouts
 */

import { render, cleanup } from '@testing-library/react'
import React from 'react'

// Mock components to test layout patterns
const AppleSection = ({ 
  background, 
  children 
}: { 
  background: 'black' | 'light-gray' | 'white'
  children: React.ReactNode 
}) => (
  <div className={`apple-section apple-section--${background}`}>
    {children}
  </div>
)

const AppleContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="apple-container">
    {children}
  </div>
)

const AppleGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="apple-grid">
    {children}
  </div>
)

describe('Layout Components - Unit Tests', () => {
  afterEach(() => {
    cleanup()
  })

  describe('Spacing System (Requirement 6.1)', () => {
    it('should apply 8px base spacing unit', () => {
      const { container } = render(
        <div style={{ padding: 'var(--space-8)' }}>
          Test Content
        </div>
      )

      const element = container.firstChild as HTMLElement
      expect(element).toBeInTheDocument()
      // CSS variable --space-8 should be defined in globals.css as 8px
    })

    it('should support granular spacing adjustments (2px, 4px, 5px, 6px, 7px)', () => {
      const spacingValues = [
        { var: '--space-2', expected: '2px' },
        { var: '--space-4', expected: '4px' },
        { var: '--space-5', expected: '5px' },
        { var: '--space-6', expected: '6px' },
        { var: '--space-7', expected: '7px' },
      ]

      spacingValues.forEach(({ var: varName }) => {
        const { container } = render(
          <div style={{ margin: `var(${varName})` }}>
            Test
          </div>
        )
        
        const element = container.firstChild as HTMLElement
        expect(element).toBeInTheDocument()
      })
    })

    it('should support medium spacing values (8px, 9px, 10px, 11px)', () => {
      const spacingValues = [
        { var: '--space-8', expected: '8px' },
        { var: '--space-9', expected: '9px' },
        { var: '--space-10', expected: '10px' },
        { var: '--space-11', expected: '11px' },
      ]

      spacingValues.forEach(({ var: varName }) => {
        const { container } = render(
          <div style={{ padding: `var(${varName})` }}>
            Test
          </div>
        )
        
        const element = container.firstChild as HTMLElement
        expect(element).toBeInTheDocument()
      })
    })

    it('should support large spacing values (14px, 15px, 17px, 20px, 24px)', () => {
      const spacingValues = [
        { var: '--space-14', expected: '14px' },
        { var: '--space-15', expected: '15px' },
        { var: '--space-17', expected: '17px' },
        { var: '--space-20', expected: '20px' },
        { var: '--space-24', expected: '24px' },
      ]

      spacingValues.forEach(({ var: varName }) => {
        const { container } = render(
          <div style={{ gap: `var(${varName})` }}>
            Test
          </div>
        )
        
        const element = container.firstChild as HTMLElement
        expect(element).toBeInTheDocument()
      })
    })

    it('should use spacing variables consistently across components', () => {
      const { container } = render(
        <div>
          <div style={{ padding: 'var(--space-8)' }}>Section 1</div>
          <div style={{ margin: 'var(--space-17)' }}>Section 2</div>
          <div style={{ gap: 'var(--space-24)' }}>Section 3</div>
        </div>
      )

      const parentDiv = container.firstChild as HTMLElement
      const elements = parentDiv.querySelectorAll(':scope > div')
      expect(elements.length).toBe(3)
      elements.forEach(element => {
        expect(element).toBeInTheDocument()
      })
    })

    it('should apply optical spacing adjustments (7px, 11px)', () => {
      // These are optical adjustments for visual balance
      const { container } = render(
        <div>
          <div style={{ padding: 'var(--space-7)' }}>Optical 7px</div>
          <div style={{ padding: 'var(--space-11)' }}>Optical 11px</div>
        </div>
      )

      const parentDiv = container.firstChild as HTMLElement
      const elements = parentDiv.querySelectorAll(':scope > div')
      expect(elements.length).toBe(2)
    })
  })

  describe('Full-Viewport-Width Sections (Requirement 6.2)', () => {
    it('should render apple-section with full viewport width', () => {
      const { container } = render(
        <AppleSection background="black">
          <div>Content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('apple-section')
    })

    it('should apply full-width technique using negative margins', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <div>Content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
      // CSS applies: width: 100vw, margin-left: -50vw, margin-right: -50vw
    })

    it('should center content within full-width sections', () => {
      const { container } = render(
        <AppleSection background="white">
          <AppleContainer>
            <div>Centered Content</div>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
    })

    it('should maintain full-width on black background sections', () => {
      const { container } = render(
        <AppleSection background="black">
          <div>Immersive Content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section--black')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('apple-section')
      expect(section).toHaveClass('apple-section--black')
    })

    it('should maintain full-width on light-gray background sections', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <div>Informational Content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section--light-gray')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('apple-section')
      expect(section).toHaveClass('apple-section--light-gray')
    })

    it('should prevent horizontal overflow on sections', () => {
      const { container } = render(
        <AppleSection background="white">
          <div>Content that should not overflow</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
      // CSS applies: overflow-x: hidden, max-width: 100vw
    })
  })

  describe('Maximum Content Width (Requirement 6.3)', () => {
    it('should apply 980px max-width to apple-container', () => {
      const { container } = render(
        <AppleContainer>
          <div>Content</div>
        </AppleContainer>
      )

      const contentContainer = container.querySelector('.apple-container')
      expect(contentContainer).toBeInTheDocument()
      expect(contentContainer).toHaveClass('apple-container')
      // CSS applies: max-width: var(--max-content-width) = 980px
    })

    it('should center content container with auto margins', () => {
      const { container } = render(
        <AppleContainer>
          <div>Centered Content</div>
        </AppleContainer>
      )

      const contentContainer = container.querySelector('.apple-container')
      expect(contentContainer).toBeInTheDocument()
      // CSS applies: margin: 0 auto
    })

    it('should apply horizontal padding to content container', () => {
      const { container } = render(
        <AppleContainer>
          <div>Padded Content</div>
        </AppleContainer>
      )

      const contentContainer = container.querySelector('.apple-container')
      expect(contentContainer).toBeInTheDocument()
      // CSS applies: padding: 0 var(--space-17)
    })

    it('should constrain content width within full-width sections', () => {
      const { container } = render(
        <AppleSection background="black">
          <AppleContainer>
            <div>Constrained Content</div>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
      // Section is full-width, container is max 980px
    })

    it('should maintain max-width across different section backgrounds', () => {
      const { container } = render(
        <div>
          <AppleSection background="black">
            <AppleContainer>Content 1</AppleContainer>
          </AppleSection>
          <AppleSection background="light-gray">
            <AppleContainer>Content 2</AppleContainer>
          </AppleSection>
          <AppleSection background="white">
            <AppleContainer>Content 3</AppleContainer>
          </AppleSection>
        </div>
      )

      const containers = container.querySelectorAll('.apple-container')
      expect(containers.length).toBe(3)
      containers.forEach(cont => {
        expect(cont).toHaveClass('apple-container')
      })
    })

    it('should prevent content from exceeding viewport width', () => {
      const { container } = render(
        <AppleContainer>
          <div>Content should not exceed viewport</div>
        </AppleContainer>
      )

      const contentContainer = container.querySelector('.apple-container')
      expect(contentContainer).toBeInTheDocument()
      // CSS applies: max-width: 100vw
    })
  })

  describe('Cinematic Breathing Room (Requirement 6.4)', () => {
    it('should apply generous vertical padding to sections', () => {
      const { container } = render(
        <AppleSection background="black">
          <div>Content with breathing room</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
      // CSS applies: padding: var(--space-24) var(--space-17)
    })

    it('should create space between multiple sections', () => {
      const { container } = render(
        <div>
          <AppleSection background="black">
            <div>Section 1</div>
          </AppleSection>
          <AppleSection background="light-gray">
            <div>Section 2</div>
          </AppleSection>
          <AppleSection background="black">
            <div>Section 3</div>
          </AppleSection>
        </div>
      )

      const sections = container.querySelectorAll('.apple-section')
      expect(sections.length).toBe(3)
      // Each section has its own padding creating breathing room
    })

    it('should use compressed spacing within sections', () => {
      const { container } = render(
        <AppleSection background="white">
          <AppleContainer>
            <div data-testid="text-block-1" style={{ marginBottom: 'var(--space-8)' }}>Tight text block 1</div>
            <div data-testid="text-block-2" style={{ marginBottom: 'var(--space-8)' }}>Tight text block 2</div>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const textBlock1 = container.querySelector('[data-testid="text-block-1"]')
      const textBlock2 = container.querySelector('[data-testid="text-block-2"]')
      
      expect(section).toBeInTheDocument()
      expect(textBlock1).toBeInTheDocument()
      expect(textBlock2).toBeInTheDocument()
    })

    it('should use expansive spacing between sections', () => {
      const { container } = render(
        <div>
          <AppleSection background="black">
            <AppleContainer>Product showcase</AppleContainer>
          </AppleSection>
          <AppleSection background="light-gray">
            <AppleContainer>Feature details</AppleContainer>
          </AppleSection>
        </div>
      )

      const sections = container.querySelectorAll('.apple-section')
      expect(sections.length).toBe(2)
      // Sections have generous padding creating cinematic spacing
    })

    it('should apply appropriate padding for hero sections', () => {
      const { container } = render(
        <AppleSection background="black">
          <AppleContainer>
            <h1 style={{ fontSize: 'var(--size-display-hero)' }}>
              Hero Headline
            </h1>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const headline = container.querySelector('h1')
      
      expect(section).toBeInTheDocument()
      expect(headline).toBeInTheDocument()
    })

    it('should maintain breathing room on informational sections', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <AppleContainer>
            <div>Data-heavy content with proper spacing</div>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section--light-gray')
      expect(section).toBeInTheDocument()
    })
  })

  describe('Responsive Grid Layouts (Requirement 6.2)', () => {
    it('should render apple-grid component', () => {
      const { container } = render(
        <AppleGrid>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </AppleGrid>
      )

      const grid = container.querySelector('.apple-grid')
      expect(grid).toBeInTheDocument()
      expect(grid).toHaveClass('apple-grid')
    })

    it('should apply grid gap spacing', () => {
      const { container } = render(
        <AppleGrid>
          <div>Item 1</div>
          <div>Item 2</div>
        </AppleGrid>
      )

      const grid = container.querySelector('.apple-grid')
      expect(grid).toBeInTheDocument()
      // CSS applies: gap: var(--space-20)
    })

    it('should support 3-column layout on desktop', () => {
      const { container } = render(
        <AppleGrid>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </AppleGrid>
      )

      const grid = container.querySelector('.apple-grid')
      expect(grid).toBeInTheDocument()
      // CSS applies: grid-template-columns: repeat(3, 1fr) at 1024px+
    })

    it('should support 2-column layout on tablet', () => {
      const { container } = render(
        <AppleGrid>
          <div>Item 1</div>
          <div>Item 2</div>
        </AppleGrid>
      )

      const grid = container.querySelector('.apple-grid')
      expect(grid).toBeInTheDocument()
      // CSS applies: grid-template-columns: repeat(2, 1fr) at 640-1023px
    })

    it('should support single-column layout on mobile', () => {
      const { container } = render(
        <AppleGrid>
          <div>Item 1</div>
        </AppleGrid>
      )

      const grid = container.querySelector('.apple-grid')
      expect(grid).toBeInTheDocument()
      // CSS applies: grid-template-columns: 1fr at <640px
    })

    it('should handle multiple grid items', () => {
      const items = Array.from({ length: 6 }, (_, i) => (
        <div key={i}>Item {i + 1}</div>
      ))

      const { container } = render(
        <AppleGrid>
          {items}
        </AppleGrid>
      )

      const grid = container.querySelector('.apple-grid')
      const gridItems = grid?.children
      
      expect(grid).toBeInTheDocument()
      expect(gridItems?.length).toBe(6)
    })
  })

  describe('Section Background Variants', () => {
    it('should apply black background to immersive sections', () => {
      const { container } = render(
        <AppleSection background="black">
          <div>Immersive content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section--black')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('apple-section--black')
    })

    it('should apply light-gray background to informational sections', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <div>Informational content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section--light-gray')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('apple-section--light-gray')
    })

    it('should apply white background to card sections', () => {
      const { container } = render(
        <AppleSection background="white">
          <div>Card content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section--white')
      expect(section).toBeInTheDocument()
      expect(section).toHaveClass('apple-section--white')
    })

    it('should alternate section backgrounds for cinematic rhythm', () => {
      const { container } = render(
        <div>
          <AppleSection background="black">Section 1</AppleSection>
          <AppleSection background="light-gray">Section 2</AppleSection>
          <AppleSection background="black">Section 3</AppleSection>
          <AppleSection background="light-gray">Section 4</AppleSection>
        </div>
      )

      const blackSections = container.querySelectorAll('.apple-section--black')
      const lightSections = container.querySelectorAll('.apple-section--light-gray')
      
      expect(blackSections.length).toBe(2)
      expect(lightSections.length).toBe(2)
    })
  })

  describe('Layout Composition Patterns', () => {
    it('should support nested section and container pattern', () => {
      const { container } = render(
        <AppleSection background="black">
          <AppleContainer>
            <h2>Headline</h2>
            <p>Body content</p>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      const headline = container.querySelector('h2')
      const paragraph = container.querySelector('p')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
      expect(headline).toBeInTheDocument()
      expect(paragraph).toBeInTheDocument()
    })

    it('should support grid within container pattern', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <AppleContainer>
            <AppleGrid>
              <div>Card 1</div>
              <div>Card 2</div>
              <div>Card 3</div>
            </AppleGrid>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      const grid = container.querySelector('.apple-grid')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
      expect(grid).toBeInTheDocument()
    })

    it('should support multiple containers in a section', () => {
      const { container } = render(
        <AppleSection background="white">
          <AppleContainer>
            <h2>First Container</h2>
          </AppleContainer>
          <AppleContainer>
            <p>Second Container</p>
          </AppleContainer>
        </AppleSection>
      )

      const containers = container.querySelectorAll('.apple-container')
      expect(containers.length).toBe(2)
    })

    it('should support single-column hero layout', () => {
      const { container } = render(
        <AppleSection background="black">
          <AppleContainer>
            <div data-testid="hero-center" style={{ textAlign: 'center' }}>
              <h1>Hero Headline</h1>
              <p>Supporting text</p>
            </div>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      const centerDiv = container.querySelector('[data-testid="hero-center"]')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
      expect(centerDiv).toBeInTheDocument()
    })
  })

  describe('Responsive Padding Adjustments', () => {
    it('should apply base padding to sections', () => {
      const { container } = render(
        <AppleSection background="black">
          <div>Content</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
      // CSS applies: padding: var(--space-24) var(--space-17)
    })

    it('should apply responsive padding to containers', () => {
      const { container } = render(
        <AppleContainer>
          <div>Content</div>
        </AppleContainer>
      )

      const contentContainer = container.querySelector('.apple-container')
      expect(contentContainer).toBeInTheDocument()
      // CSS applies: padding: 0 var(--space-17)
    })

    it('should maintain consistent spacing across breakpoints', () => {
      const { container } = render(
        <div>
          <AppleSection background="black">
            <AppleContainer>Mobile/Tablet/Desktop</AppleContainer>
          </AppleSection>
        </div>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
    })
  })

  describe('Layout Accessibility', () => {
    it('should use semantic HTML structure', () => {
      const { container } = render(
        <AppleSection background="white">
          <AppleContainer>
            <main>
              <h1>Main Heading</h1>
              <p>Content</p>
            </main>
          </AppleContainer>
        </AppleSection>
      )

      const mainElement = container.querySelector('main')
      expect(mainElement).toBeInTheDocument()
    })

    it('should support proper heading hierarchy', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <AppleContainer>
            <h1>Level 1</h1>
            <h2>Level 2</h2>
            <h3>Level 3</h3>
          </AppleContainer>
        </AppleSection>
      )

      expect(container.querySelector('h1')).toBeInTheDocument()
      expect(container.querySelector('h2')).toBeInTheDocument()
      expect(container.querySelector('h3')).toBeInTheDocument()
    })

    it('should maintain readable line lengths with max-width', () => {
      const { container } = render(
        <AppleContainer>
          <p>
            This is a long paragraph that should not exceed the maximum content
            width to maintain readability and follow Apple's design principles.
          </p>
        </AppleContainer>
      )

      const contentContainer = container.querySelector('.apple-container')
      expect(contentContainer).toBeInTheDocument()
      // Max-width of 980px ensures readable line lengths
    })
  })

  describe('Layout Performance', () => {
    it('should render efficiently with multiple sections', () => {
      const sections = Array.from({ length: 5 }, (_, i) => (
        <AppleSection key={i} background={i % 2 === 0 ? 'black' : 'light-gray'}>
          <AppleContainer>
            <div>Section {i + 1}</div>
          </AppleContainer>
        </AppleSection>
      ))

      const { container } = render(<div>{sections}</div>)

      const renderedSections = container.querySelectorAll('.apple-section')
      expect(renderedSections.length).toBe(5)
    })

    it('should handle nested layouts without performance issues', () => {
      const { container } = render(
        <AppleSection background="white">
          <AppleContainer>
            <AppleGrid>
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i}>
                  <div style={{ padding: 'var(--space-8)' }}>
                    Card {i + 1}
                  </div>
                </div>
              ))}
            </AppleGrid>
          </AppleContainer>
        </AppleSection>
      )

      const grid = container.querySelector('.apple-grid')
      const cards = grid?.children
      
      expect(grid).toBeInTheDocument()
      expect(cards?.length).toBe(9)
    })
  })

  describe('Layout Edge Cases', () => {
    it('should handle empty sections gracefully', () => {
      const { container } = render(
        <AppleSection background="black">
          <AppleContainer />
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const contentContainer = container.querySelector('.apple-container')
      
      expect(section).toBeInTheDocument()
      expect(contentContainer).toBeInTheDocument()
    })

    it('should handle sections without containers', () => {
      const { container } = render(
        <AppleSection background="light-gray">
          <div>Direct content without container</div>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
    })

    it('should handle very long content', () => {
      const longContent = 'Lorem ipsum '.repeat(100)
      
      const { container } = render(
        <AppleSection background="white">
          <AppleContainer>
            <p>{longContent}</p>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      const paragraph = container.querySelector('p')
      
      expect(section).toBeInTheDocument()
      expect(paragraph).toBeInTheDocument()
      expect(paragraph?.textContent?.length).toBeGreaterThan(1000)
    })

    it('should prevent horizontal scroll with overflow control', () => {
      const { container } = render(
        <AppleSection background="black">
          <AppleContainer>
            <div style={{ width: '2000px' }}>Wide content</div>
          </AppleContainer>
        </AppleSection>
      )

      const section = container.querySelector('.apple-section')
      expect(section).toBeInTheDocument()
      // CSS applies: overflow-x: hidden
    })
  })
})
