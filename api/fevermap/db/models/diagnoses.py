# -*- coding: utf-8 -*-

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import ForeignKey

from fevermap.db.base import Base

from dataclasses import dataclass


@dataclass
class Diagnoses(Base):
    """Diagnoses of a submitter."""

    __tablename__ = 'diagnosis'

    covid19 = Column(Boolean)

    submitter_id = Column(Integer, ForeignKey('submitters.id'))

    def __repr__(self):
        return '<Submission(id={})>'.format(self.id)
