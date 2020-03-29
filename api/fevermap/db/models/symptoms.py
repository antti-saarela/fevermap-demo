# -*- coding: utf-8 -*-

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import ForeignKey

from fevermap.db.base import Base

from dataclasses import dataclass


@dataclass
class Symptoms(Base):
    """Symptoms in a submission."""

    __tablename__ = 'symptoms'

    difficult_to_breath = Column(Boolean)
    cough = Column(Boolean)
    sore_throat = Column(Boolean)
    muscle_pain = Column(Boolean)

    submission_id = Column(Integer, ForeignKey('submissions.id'))

    def __repr__(self):
        return '<Symptom(id={})>'.format(self.id)
