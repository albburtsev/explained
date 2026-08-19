## ADDED Requirements

### Requirement: Author-defined course catalogue order

The site SHALL display complete course catalogues in ascending `catalogOrder`. The home-page catalogue and the `/courses` catalogue SHALL use the same ordering behavior, and alphabetical title order SHALL NOT override the author-defined order.

#### Scenario: Visitor opens the home-page catalogue

- **WHEN** the course collection contains entries with distinct `catalogOrder` values
- **THEN** the home page displays the courses from the lowest value to the highest value

#### Scenario: Visitor opens the courses catalogue

- **WHEN** the visitor opens `/courses`
- **THEN** the courses appear in the same order as on the home page

#### Scenario: A course title changes

- **WHEN** an author changes a course title without changing its `catalogOrder`
- **THEN** the course retains its position relative to the other courses

#### Scenario: An author changes catalogue order

- **WHEN** an author changes courses to another valid set of `catalogOrder` values
- **THEN** every complete course catalogue reflects the new ascending order at publication
